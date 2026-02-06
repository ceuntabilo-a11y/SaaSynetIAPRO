export default async function handler(req, res) {
  // CORS básico (para que tu frontend pueda llamar al endpoint)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body = req.method === "POST" ? req.body : {};
    const apiKey = body.apiKey;
    const q = body.q;
    const location = body.location || "Chile";
    const num = body.num || 10;

    if (!apiKey) return res.status(400).json({ error: "Missing apiKey" });
    if (!q) return res.status(400).json({ error: "Missing q" });

    const url =
      `https://serpapi.com/search.json` +
      `?engine=google_maps` +
      `&q=${encodeURIComponent(q)}` +
      `&location=${encodeURIComponent(location)}` +
      `&num=${encodeURIComponent(String(num))}` +
      `&api_key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(url);
    const data = await r.json();

    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
