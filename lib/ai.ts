
import { GoogleGenAI, Type } from "@google/genai";
import { BusinessData } from "../types";

export const enrichLeadsWithAI = async (leads: BusinessData[]): Promise<BusinessData[]> => {
  if (leads.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Preparamos un prompt masivo para optimizar tokens
  const prompt = `Analiza la siguiente lista de negocios extraídos de Google Maps. 
  Para cada negocio, determina:
  1. aiScore: 'Premium' (si tiene muchas reseñas y web), 'Estándar' o 'Bajo'.
  2. aiNiche: Clasificación b2b o b2c.
  3. aiSentiment: Sentimiento general basado en estrellas.
  4. aiSummary: Un resumen de 10 palabras sobre su potencial cliente.

  Lista de negocios:
  ${leads.map((l, i) => `${i}: ${l.name} | Cat: ${l.categoryName} | Stars: ${l.stars}`).join('\n')}
  
  Devuelve un JSON estrictamente con este formato: [{ id: number, aiScore: string, aiSummary: string, aiNiche: string, aiSentiment: string }]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
              aiSentiment: { type: Type.STRING }
            },
            required: ["id", "aiScore", "aiSummary", "aiNiche", "aiSentiment"]
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
