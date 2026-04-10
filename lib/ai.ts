import { BusinessData } from "../types";

export const enrichLeadsWithAI = async (leads: BusinessData[]): Promise<BusinessData[]> => {
  if (leads.length === 0) return [];

  const apiKey = import.meta.env.VITE_GROQ_API_KEY || "";
  if (!apiKey) {
    console.error("No se encontró VITE_GROQ_API_KEY");
    return leads;
  }

  const prompt = `Eres un experto en prospección B2B para una agencia de automatización e inteligencia artificial llamada SynetIA.

Tu tarea es analizar negocios extraídos de Google Maps y evaluar su potencial como clientes para estos servicios:
1. Automatizaciones y bots de WhatsApp / atención al cliente
2. Sistemas de gestión digital (agendas, CRM, dashboards)
3. SynetIA DICOM Relay: plataforma de transmisión segura de estudios de imagenología médica (radiografías, tomografías, resonancias) directamente al médico tratante — ideal para clínicas radiológicas, centros de imagen, hospitales, clínicas dentales con rayos X, veterinarias con diagnóstico por imagen

Para cada negocio analiza:
- Si tiene web o no (sin web = oportunidad digital alta)
- Si su categoría sugiere uso de tomografía/imagenología
- Su potencial para automatizaciones según el sector
- Un resumen como pitch de venta corto

Lista de negocios:
${leads.map((l, i) => `${i}: Nombre: "${l.name}" | Categoría: "${l.categoryName}" | Estrellas: ${l.stars || 'N/A'} | Reseñas: ${l.reviewsCount || '0'} | Web: ${l.website ? 'SÍ' : 'NO'} | Dirección: "${l.address || ''}"`).join('\n')}

Devuelve SOLO un array JSON válido sin markdown ni texto adicional con este formato exacto:
[{"id":0,"aiScore":"Premium","aiSummary":"resumen aquí","aiNiche":"Médico-DICOM","aiSentiment":"Positivo","aiDicom":true}]

Valores posibles:
- aiScore: "Premium", "Estándar" o "Bajo"
- aiNiche: "Médico-DICOM", "Automatización", "Digital" o "Multi-servicio"
- aiSentiment: "Positivo", "Neutro" o "Negativo"
- aiDicom: true o false`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: prompt,
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Groq error:", err);
      return leads;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "[]";

    // Limpiar posibles markdown fences
    const clean = text.replace(/```json|```/g, "").trim();
    const aiResults = JSON.parse(clean);

    return leads.map((lead, index) => {
      const enrichment = aiResults.find((r: any) => r.id === index);
      return enrichment ? { ...lead, ...enrichment } : lead;
    });
  } catch (error) {
    console.error("Error en enriquecimiento IA:", error);
    return leads;
  }
};