import { BusinessData } from "../types";

interface WebData {
  ok: boolean;
  email: string | null;
  allEmails?: string[];
  webStatus?: string;
  webSummary?: string;
  hasWhatsApp?: boolean;
  hasBooking?: boolean;
  hasSocialMedia?: boolean;
  webScore?: number;
  textPreview?: string;
}

const fetchWebData = async (url: string): Promise<WebData> => {
  try {
    const res = await fetch("/api/scrape-web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return await res.json();
  } catch {
    return { ok: false, email: null, webStatus: "error", webSummary: "No se pudo analizar" };
  }
};

const analyzeWithGroq = async (lead: BusinessData, webData: WebData): Promise<Partial<BusinessData>> => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY || "";
  if (!apiKey) return {};

  const reviewsNum = parseInt(String(lead.reviewsCount || "0").replace(/\D/g, "")) || 0;
  const starsNum = parseFloat(String(lead.stars || "0")) || 0;
  const hasWeb = !!lead.website;
  const businessType = `${lead.name} ${lead.categoryName}`.toLowerCase();

  // Tamaño genérico basado en reseñas
  let size = "negocio sin reseñas visibles";
  if (reviewsNum > 500) size = "negocio muy consolidado";
  else if (reviewsNum > 100) size = "negocio grande";
  else if (reviewsNum > 30) size = "negocio mediano";
  else if (reviewsNum > 0) size = "negocio pequeño o nuevo";

  // Reputación
  let reputation = "";
  if (starsNum >= 4.8) reputation = "reputación excelente";
  else if (starsNum >= 4.5) reputation = "buena reputación";
  else if (starsNum >= 4.0) reputation = "reputación aceptable";
  else if (starsNum > 0) reputation = "reputación mejorable";

  // Candidato DICOM solo para negocios de salud/imagen médica
  const isDicomCandidate = /(dental|dent|odont|radiolog|hospital|veterina|ortoped|neurol|oncolog|médic|medic|imagen|rayos|tomograf|ecograf)/i.test(businessType);

  // Contexto web
  let webContext = "Sin sitio web.";
  if (hasWeb) {
    const parts: string[] = [];
    if (webData.webStatus) parts.push(`Web ${webData.webStatus}`);
    if (webData.hasWhatsApp) parts.push("tiene WhatsApp integrado");
    else parts.push("sin WhatsApp visible");
    if (webData.hasBooking) parts.push("tiene reservas/citas online");
    else parts.push("sin sistema de reservas online");
    if (webData.hasSocialMedia) parts.push("vinculada a redes sociales");
    if (webData.email) parts.push(`email público: ${webData.email}`);
    webContext = parts.join(", ") + ".";
    if (webData.textPreview) {
      webContext += ` Contenido: "${webData.textPreview.slice(0, 200)}"`;
    }
  }

  const prompt = `Eres un ejecutivo de ventas B2B de SynetIA. Analizas negocios reales y escribes fichas de prospección concretas para el equipo comercial.

SERVICIOS DE SYNETIA (elige solo los relevantes para este tipo de negocio):
- Bot de WhatsApp: atiende clientes 24/7, responde preguntas frecuentes, toma pedidos/reservas, envía recordatorios automáticos.
- Gestión Digital: agenda online, CRM de clientes, dashboard de métricas, automatización de seguimiento.
- SynetIA DICOM Relay: envío seguro de estudios de imagenología (solo para clínicas, hospitales, dentistas, veterinarias con diagnóstico por imagen).

NEGOCIO A ANALIZAR:
- Nombre: ${lead.name}
- Categoría: ${lead.categoryName || "No especificado"}
- Ubicación: ${lead.address || "No disponible"}
- Estrellas: ${starsNum > 0 ? `${starsNum}/5` : "Sin calificación"}
- Reseñas Google: ${reviewsNum > 0 ? reviewsNum : "Sin reseñas"}
- Tamaño: ${size}
- Reputación: ${reputation || "desconocida"}
- Web: ${hasWeb ? lead.website : "NO TIENE"}
- Estado web: ${webContext}

INSTRUCCIONES:
1. aiSummary: 25-35 palabras. Menciona el TIPO EXACTO de negocio (no uses "clínica" si es restaurante, tienda, etc.), tamaño, ubicación real, y la brecha principal. Sé específico y directo.
   Ejemplos para distintos rubros:
   - Restaurante: "Restaurante italiano con 8863 reseñas en Mendoza sin sistema de reservas online. Bot WhatsApp automatizaría consultas de mesas y menú del día."
   - Tienda: "Tienda de ropa en Santiago con 45 reseñas, web activa sin WhatsApp. Bot respondería consultas de stock y tallas las 24 horas."
   - Dentista: "Clínica dental con 121 reseñas en Bogotá sin citas online. Bot WhatsApp eliminaría llamadas manuales y DICOM agilizaría envío de radiografías."
   - Hotel: "Hotel boutique en Buenos Aires con 320 reseñas sin sistema de reservas directo. Bot WhatsApp captaría reservas sin comisiones de intermediarios."

2. aiScore: "Premium" si +100 reseñas o candidato DICOM con web. "Estándar" si 20-100 reseñas. "Bajo" si menos de 20 reseñas o sin web ni teléfono.

3. aiNiche: el servicio MÁS relevante para este negocio específico: "DICOM" / "Bot WhatsApp" / "Gestión Digital" / "Multi-servicio"

4. aiServices: máximo 3 servicios. Formato: "Nombre: razón específica para ESTE negocio". Solo incluye DICOM si es un negocio de salud con imagen médica.

5. aiDicom: true SOLO si el negocio maneja radiografías, ecografías, tomografías u otras imágenes médicas (dental, radiología, hospital, veterinaria diagnóstica).

Responde ÚNICAMENTE con JSON válido, sin markdown:
{"aiSummary":"...","aiScore":"...","aiNiche":"...","aiServices":["...","..."],"aiDicom":false}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Eres un ejecutivo de ventas B2B experto. Analizas cualquier tipo de negocio con precisión. Nunca confundas el rubro de un negocio. Nunca uses terminología de salud para negocios que no son del sector salud. Siempre respondes en JSON válido sin markdown."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (isDicomCandidate && parsed.aiDicom === undefined) {
      parsed.aiDicom = true;
    }

    return parsed;
  } catch {
    return {};
  }
};

export const enrichLeadsWithAI = async (leads: BusinessData[]): Promise<BusinessData[]> => {
  if (leads.length === 0) return [];

  const enriched: BusinessData[] = [];

  for (const lead of leads) {
    let webData: WebData = { ok: false, email: null };

    if (lead.website) {
      webData = await fetchWebData(lead.website);
    }

    const aiData = await analyzeWithGroq(lead, webData);

    enriched.push({
      ...lead,
      email: webData.email || lead.email,
      ...aiData,
    });

    await new Promise(r => setTimeout(r, 400));
  }

  return enriched;
};