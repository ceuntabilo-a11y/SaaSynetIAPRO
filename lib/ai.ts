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

  const hasWeb = !!lead.website;
  const reviewsNum = parseInt(String(lead.reviewsCount || "0").replace(/\D/g, "")) || 0;
  const starsNum = parseFloat(String(lead.stars || "0")) || 0;

  let sizeEstimate = "pequeño";
  if (reviewsNum > 200) sizeEstimate = "grande";
  else if (reviewsNum > 50) sizeEstimate = "mediano";

  const prompt = `Eres un consultor de ventas B2B experto para la empresa SynetIA que ofrece:
1. Bots de WhatsApp y automatización de atención al cliente
2. Sistemas de gestión digital (agendas, CRM, dashboards)  
3. SynetIA DICOM Relay: transmisión segura de radiografías/tomografías al médico tratante (ideal para clínicas dentales, radiológicas, hospitales, veterinarias con imagen)

Analiza este negocio y dame un análisis de prospección comercial real y específico:

NEGOCIO: ${lead.name}
CATEGORÍA: ${lead.categoryName || "No especificada"}
DIRECCIÓN: ${lead.address || "No disponible"}
ESTRELLAS: ${starsNum}/5
RESEÑAS: ${reviewsNum}
TAMAÑO ESTIMADO: ${sizeEstimate}
TIENE WEB: ${hasWeb ? "SÍ - " + lead.website : "NO"}
${hasWeb ? `ANÁLISIS WEB: ${webData.webSummary || "No analizado"}` : ""}
${hasWeb ? `TIENE WHATSAPP EN WEB: ${webData.hasWhatsApp ? "SÍ" : "NO"}` : ""}
${hasWeb ? `TIENE SISTEMA DE CITAS: ${webData.hasBooking ? "SÍ" : "NO"}` : ""}
EMAIL ENCONTRADO: ${webData.email || "No encontrado"}

Dame:
1. aiSummary: Resumen específico de 20-25 palabras sobre ESTE negocio en particular. Menciona su tamaño, ubicación aproximada y oportunidad concreta. NO uses frases genéricas.
2. aiScore: "Premium" si tiene más de 100 reseñas O es clínica dental/radiológica/hospital, "Estándar" si tiene 20-100 reseñas, "Bajo" si tiene menos de 20
3. aiNiche: El servicio MÁS relevante: "DICOM" si es dental/radiología/veterinaria/hospital, "Bot WhatsApp" si necesita automatización de citas, "Gestión Digital" si necesita CRM/agenda, "Multi-servicio" si aplica todo
4. aiServices: Lista de máximo 3 servicios que le puedes ofrecer con justificación de 5 palabras cada uno
5. aiDicom: true SOLO si es clínica dental, radiológica, hospital, veterinaria o centro médico con imagen

Responde SOLO en JSON válido sin markdown:
{
  "aiSummary": "...",
  "aiScore": "...",
  "aiNiche": "...", 
  "aiServices": ["servicio: justificación", "servicio: justificación"],
  "aiDicom": true/false
}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
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

    // Pequeña pausa para no saturar la API
    await new Promise(r => setTimeout(r, 300));
  }

  return enriched;
};