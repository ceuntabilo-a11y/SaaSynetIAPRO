// lib/scraper.ts

export type SerpSearchInput = {
  apiKey: string;      // la pega el usuario en Motor API
  q: string;           // keyword/nicho
  location?: string;  // ej: "Chile" o "Santiago, Chile"
  num?: number;        // cantidad de resultados
};

export async function searchWithSerp(input: SerpSearchInput) {
  const payload = {
    apiKey: input.apiKey,
    q: input.q,
    location: input.location ?? "Chile",
    num: input.num ?? 10,
  };

  const res = await fetch("/api/serp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error /api/serp (${res.status}): ${text || "Sin detalle"}`);
  }

  return res.json();
}
