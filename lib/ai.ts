import { GoogleGenAI, Type } from "@google/genai";
import { BusinessData } from "../types";

export const enrichLeadsWithAI = async (leads: BusinessData[]): Promise<BusinessData[]> => {
  if (leads.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  if (!apiKey) {
    console.error("No se encontró GEMINI_API_KEY");
    return leads;
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Eres un experto en prospección B2B para una agencia de automatización e inteligencia artificial llamada SynetIA.

Tu tarea es analizar negocios extraídos de Google Maps y evaluar su potencial como clientes para estos servicios:
1. Automatizaciones y bots de WhatsApp / atención al cliente
2. Sistemas de gestión digital (agendas, CRM, dashboards)
3. SynetIA DICOM Relay: plataforma de transmisión segura de estudios de imagenología médica (radiografías, tomografías, resonancias) directamente al médico tratante — ideal para clínicas radiológicas, centros de imagen, hospitales, clínicas dentales con rayos X, veterinarias con diagnóstico por imagen

Para cada negocio analiza:
- Si tiene web o no (sin web = oportunidad digital alta)
- Si su categoría sugiere uso de tomografía/imagenología (radiología, clínica dental, veterinaria, hospital, ortopedia, neurología, oncología)
- Su potencial para automatizaciones según el sector
- Un resumen como si fuera un pitch de venta corto

Lista de negocios:
${leads.map((l, i) => `${i}: Nombre: "${l.name}" | Categoría: "${l.categoryName}" | Estrellas: ${l.stars || 'N/A'} | Reseñas: ${l.reviewsCount || '0'} | Web: ${l.website ? 'SÍ' : 'NO'} | Dirección: "${l.address || ''}"`).join('\n')}

Para cada negocio devuelve:
- id: número del negocio
- aiScore: "Premium" (alto potencial, muchas reseñas o sector médico/dental), "Estándar" (potencial medio), "Bajo" (poco potencial)
- aiSummary: resumen de máximo 20 palabras enfocado en oportunidad de venta. Ejemplo: "Clínica dental sin web, ideal para bot de citas y relay DICOM de radiografías"
- aiNiche: "Médico-DICOM" (si usa imagenología), "Automatización" (si aplica bot/CRM), "Digital" (si necesita presencia web), "Multi-servicio" (si aplica todo)
- aiSentiment: "Positivo", "Neutro" o "Negativo" según sus reseñas y estrellas
- aiDicom: true si el negocio podría necesitar SynetIA DICOM (clínica dental, radiología, veterinaria, hospital, centro médico con imagen), false si no

Devuelve SOLO un JSON válido sin markdown ni texto adicional.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              aiScore: { type: Type.STRING },
              aiSummary: { type: Type.STRING },
              aiNiche: { type: Type.STRING },
              aiSentiment: { type: Type.STRING },
              aiDicom: { type: Type.BOOLEAN }
            },
            required: ["id", "aiScore", "aiSummary", "aiNiche", "aiSentiment", "aiDicom"]
          }
        }
      }
    });

    const aiResults = JSON.parse(response.text || "[]");

    return leads.map((lead, index) => {
      const enrichment = aiResults.find((r: any) => r.id === index);
      return enrichment ? { ...lead, ...enrichment } : lead;
    });
  } catch (error) {
    console.error("Error en enriquecimiento IA:", error);
    return leads;
  }
};