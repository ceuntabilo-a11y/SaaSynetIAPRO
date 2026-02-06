// lib/scraper.ts

export type SerpSearchInput = {
  apiKey: string;
  q: string;
  location?: string;
  num?: number;
  start?: number;

  ll?: string; // puede venir como "lat,lng" o "@lat,lng,14z"
  z?: number;  // solo si NO hay ll
};

const toSerpLL = (ll: string, zoom: number) => {
  const s = (ll || "").trim();
  if (!s) return "";

  // Si ya viene con formato "@...,...,...z" lo dejamos tal cual
  if (s.startsWith("@") && s.includes("z")) return s;

  // Si viene como "lat,lng" lo transformamos
  const parts = s.split(",").map(x => x.trim());
  if (parts.length < 2) return "";
  const lat = parts[0];
  const lng = parts[1];

  // Formato aceptado: "@lat,lng,14z"
  return `@${lat},${lng},${zoom}z`;
};

export async function searchWithSerp(input: SerpSearchInput) {
  const rawLL = (input.ll || "").trim();
  const hasLL = Boolean(rawLL);

  const payload: any = {
    apiKey: input.apiKey,
    q: input.q,
    location: input.location ?? "Chile",
    num: input.num ?? 10,
    start: input.start ?? 0,
  };

  if (hasLL) {
    // ✅ convertimos siempre al formato correcto
    payload.ll = toSerpLL(rawLL, 14);
    // ✅ NO mandamos z si hay ll
  } else {
    // ✅ solo si NO hay ll, mandamos z
    payload.z = input.z ?? 14;
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
