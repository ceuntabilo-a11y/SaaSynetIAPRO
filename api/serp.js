export default async function handler(req, res) {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.method === "POST" ? (req.body || {}) : {};

    const apiKey = body.apiKey;
    const q = body.q;
    const location = body.location || "Chile";

    // num: cantidad por página
    const numRaw = body.num ?? 10;
    const num = Number(numRaw);

    // start: offset (0, 20, 40, etc.)
    const startRaw = body.start ?? 0;
    const start = Number(startRaw);

    // z: zoom requerido por SerpApi cuando usas location
    // (valor típico: 12-15; 14 suele ir bien para ciudades)
    const zRaw = body.z ?? 14;
    const z = Number(zRaw);

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

    const url =
      `https://serpapi.com/search.json` +
      `?engine=google_maps` +
      `&q=${encodeURIComponent(q)}` +
      `&location=${encodeURIComponent(location)}` +
      `&num=${encodeURIComponent(String(num))}` +
      `&start=${encodeURIComponent(String(start))}` +
      `&z=${encodeURIComponent(String(z))}` +
      `&api_key=${encodeURIComponent(apiKey)}`;

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
