// lib/scraper.ts

export type SerpSearchInput = {
  apiKey: string;
  q: string;
  location?: string;
  num?: number;
  start?: number;

  // ✅ NUEVO: coordenadas para evitar "Unsupported location"
  ll?: string; // "lat,lng" (ej: "40.7128,-74.0060")

  // opcional
  z?: number; // zoom
};

export async function searchWithSerp(input: SerpSearchInput) {
  const payload: any = {
    apiKey: input.apiKey,
    q: input.q,
    location: input.location ?? "Chile",
    num: input.num ?? 10,
    start: input.start ?? 0,
    z: input.z ?? 14,
  };

  // ✅ Si viene ll, lo mandamos también
  if (input.ll && input.ll.trim()) {
    payload.ll = input.ll.trim();
  }

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
 * Info de cuenta SerpApi.
 * (Si alguna vez diera CORS, lo pasamos a un /api/account.js, pero ahora lo dejamos así.)
 */
export async function getSerpApiAccountInfo(apiKey: string) {
  if (!apiKey) return null;

  const url = `https://serpapi.com/account?api_key=${encodeURIComponent(apiKey)}`;

  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();

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
