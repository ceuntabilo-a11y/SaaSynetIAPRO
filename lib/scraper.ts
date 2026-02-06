// lib/scraper.ts

export type SerpSearchInput = {
  apiKey: string;        // la pega el usuario en Motor API
  q: string;             // keyword/nicho
  location?: string;     // ej: "Chile" o "Santiago, Chile"
  num?: number;          // cantidad de resultados
  start?: number;        // paginación: 0, 20, 40...
};

export async function searchWithSerp(input: SerpSearchInput) {
  const payload = {
    apiKey: input.apiKey,
    q: input.q,
    location: input.location ?? "Chile",
    num: input.num ?? 10,
    start: input.start ?? 0,
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

/**
 * Obtiene info de cuenta SerpApi (saldo/plan).
 * Esto NO pasa por /api/serp porque es un endpoint distinto de SerpApi.
 * Si te diera CORS en producción, lo metemos luego en /api/account.js,
 * pero primero dejemos el build en verde.
 */
export async function getSerpApiAccountInfo(apiKey: string) {
  if (!apiKey) return null;

  const url = `https://serpapi.com/account?api_key=${encodeURIComponent(apiKey)}`;

  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();

    // Normalizamos a lo que tu Dashboard espera:
    // info.planSearchesLeft / info.searchesPerMonth
    // Si SerpApi cambia nombres, esto evita que explote.
    const planSearchesLeft =
      data?.plan_searches_left ??
      data?.planSearchesLeft ??
      data?.searches_left ??
      0;

    const searchesPerMonth =
      data?.searches_per_month ??
      data?.searchesPerMonth ??
      data?.plan_searches ??
      0;

    return {
      planSearchesLeft: Number(planSearchesLeft) || 0,
      searchesPerMonth: Number(searchesPerMonth) || 0,
      raw: data,
    };
  } catch {
    return null;
  }
}
