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

  // Determinar tamaño real basado en reseñas
  let size = "consultorio pequeño";
  if (reviewsNum > 300) size = "clínica grande consolidada";
  else if (reviewsNum > 100) size = "clínica mediana activa";
  else if (reviewsNum > 30) size = "consultorio mediano";
  else if (reviewsNum > 0) size = "consultorio pequeño o nuevo";
  else size = "sin reseñas visibles";

  // Determinar reputación
  let reputation = "";
  if (starsNum >= 4.8) reputation = "reputación excelente";
  else if (starsNum >= 4.5) reputation = "buena reputación";
  else if (starsNum >= 4.0) reputation = "reputación aceptable";
  else if (starsNum > 0) reputation = "reputación mejorable";

  // Determinar si es candidato DICOM
  const isDicomCandidate = /(dental|dent|odont|radiolog|clínica|clinic|hospital|veterina|ortoped|neurol|oncolog|médic|medic|imagen|rayos|tomograf)/i.test(
    `${lead.name} ${lead.categoryName}`
  );

  // Construir contexto web detallado
  let webContext = "Sin sitio web — oportunidad de presencia digital desde cero.";
  if (hasWeb) {
    const parts = [];
    if (webData.webStatus) parts.push(`Web ${webData.webStatus}`);
    if (webData.hasWhatsApp) parts.push("tiene WhatsApp integrado");
    else parts.push("sin WhatsApp visible");
    if (webData.hasBooking) parts.push("tiene sistema de citas online");
    else parts.push("sin sistema de citas");
    if (webData.hasSocialMedia) parts.push("vinculada a redes sociales");
    if (webData.email) parts.push(`email público: ${webData.email}`);
    webContext = parts.join(", ") + ".";
    if (webData.textPreview) {
      webContext += ` Contenido detectado: "${webData.textPreview.slice(0, 200)}"`;
    }
  }

  const prompt = `Eres un ejecutivo de ventas B2B de SynetIA. Tu trabajo es analizar negocios reales y escribir fichas de prospección concretas y útiles para el equipo comercial.

SERVICIOS QUE OFRECE SYNETIA:
- SynetIA DICOM Relay: plataforma para enviar estudios de imagenología (radiografías, tomografías, ecografías) del centro radiológico directamente al médico tratante, de forma segura y sin instalaciones. El médico recibe un email y descarga el estudio con un click. Sin almacenamiento permanente. Ideal para: clínicas dentales con rayos X, centros radiológicos, hospitales, veterinarias con diagnóstico por imagen.
- Bot de WhatsApp: automatización de respuestas, agendamiento de citas, recordatorios y seguimiento de pacientes/clientes por WhatsApp.
- Gestión Digital: agenda online, CRM de pacientes/clientes, dashboard de métricas, recordatorios automáticos.

NEGOCIO A ANALIZAR:
- Nombre: ${lead.name}
- Tipo: ${lead.categoryName || "No especificado"}
- Ubicación: ${lead.address || "No disponible"}
- Estrellas: ${starsNum > 0 ? `${starsNum}/5` : "Sin calificación"}
- Reseñas en Google: ${reviewsNum > 0 ? reviewsNum : "Sin reseñas"}
- Tamaño estimado: ${size}
- Reputación: ${reputation || "desconocida"}
- Sitio web: ${hasWeb ? lead.website : "NO TIENE"}
- Estado web: ${webContext}

INSTRUCCIONES ESTRICTAS:
1. El aiSummary debe ser una ficha comercial real de 25-35 palabras. Debe mencionar: el tipo exacto de negocio, su tamaño real, su ubicación específica, y LA BRECHA más importante que SynetIA puede resolver. Sé directo y concreto. PROHIBIDO usar frases genéricas como "alto potencial" o "oportunidad de mejora".
   Ejemplos buenos:
   - "Clínica dental con 121 reseñas en Mendoza sin sistema de citas online. Bot WhatsApp eliminaría llamadas manuales y DICOM agilizaría envío de radiografías."
   - "Urgencias dentales en Maipú, 82 reseñas, web activa sin WhatsApp. Pacientes en emergencia necesitan respuesta inmediata — bot ideal."
   - "Consultorio dental nuevo en Graneros, solo 2 reseñas, sin web. Necesita presencia digital completa antes que automatización."

2. aiScore: "Premium" si tiene +100 reseñas o es candidato DICOM con web activa. "Estándar" si tiene 20-100 reseñas. "Bajo" si tiene menos de 20 reseñas o sin web ni teléfono.

3. aiNiche: Elige el servicio MÁS urgente según la brecha detectada: "DICOM" / "Bot WhatsApp" / "Gestión Digital" / "Multi-servicio"

4. aiServices: Máximo 3 servicios. Cada uno debe tener el formato "Nombre del servicio: razón específica basada en los datos de este negocio". NO repitas la misma justificación en distintos servicios.

5. aiDicom: true si el negocio maneja diagnóstico por imagen (dental, radiología, veterinaria, hospital).

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto extra:
{"aiSummary":"...","aiScore":"...","aiNiche":"...","aiServices":["...","...","..."],"aiDicom":true}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "system",
            content: "Eres un ejecutivo de ventas B2B experto. Escribes fichas de prospección precisas, concretas y basadas en datos reales. Nunca usas frases genéricas. Siempre respondes en JSON válido."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Aseguramos que aiDicom sea correcto si el modelo falla
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