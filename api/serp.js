export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    const apiKey = body.apiKey;
    const q = body.q;

    // num
    const num = Number(body.num ?? 10);
    // start
    const start = Number(body.start ?? 0);
    // z (zoom)
    const z = Number(body.z ?? 14);

    // NUEVO:
    // ll debe venir como string: "@lat,lng,zoomz" o "lat,lng"
    // Ej: "-33.4489,-70.6693"
    const ll = typeof body.ll === "string" ? body.ll.trim() : "";

    // fallback si no hay ll
    const location = (body.location || "Chile").toString();

    if (!apiKey) return res.status(400).json({ error: "Missing apiKey" });
    if (!q) return res.status(400).json({ error: "Missing q" });

    if (!Number.isFinite(num) || num <= 0) {
      return res.status(400).json({ error: "Invalid num" });
    }
    if (!Number.isFinite(start) || start < 0) {
      return res.status(400).json({ error: "Invalid start" });
    }
    if (!Number.isFinite(z) || z <= 0) {
      return res.status(400).json({ error: "Invalid z" });
    }

    // Armamos URL base
    let url =
      `https://serpapi.com/search.json` +
      `?engine=google_maps` +
      `&q=${encodeURIComponent(q)}` +
      `&num=${encodeURIComponent(String(num))}` +
      `&start=${encodeURIComponent(String(start))}` +
      `&z=${encodeURIComponent(String(z))}` +
      `&api_key=${encodeURIComponent(apiKey)}`;

    // Si viene ll, usamos ll (RECOMENDADO)
    if (ll) {
      // SerpApi acepta ll como "lat,lng" o "@lat,lng,zoomz"
      url += `&ll=${encodeURIComponent(ll)}`;
    } else {
      // fallback: location (puede fallar en algunos formatos)
      url += `&location=${encodeURIComponent(location)}`;
    }

    const r = await fetch(url);

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
