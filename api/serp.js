export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Mapa "País|Ciudad" -> "lat,lng"
  const CITY_LL_RAW = {
    "España|Madrid": "40.4168,-3.7038",
    "España|Barcelona": "41.3851,2.1734",

    "Estados Unidos|Washington D.C.": "38.9072,-77.0369",
    "Estados Unidos|New York": "40.7128,-74.0060",

    "México|Ciudad de México": "19.4326,-99.1332",
    "México|Monterrey": "25.6866,-100.3161",

    "Argentina|Buenos Aires": "-34.6037,-58.3816",
    "Argentina|Córdoba": "-31.4201,-64.1888",

    "Colombia|Bogotá": "4.7110,-74.0721",
    "Colombia|Medellín": "6.2442,-75.5812",

    "Chile|Santiago": "-33.4489,-70.6693",
    "Chile|Concepción": "-36.8201,-73.0444",

    "Perú|Lima": "-12.0464,-77.0428",
    "Perú|Arequipa": "-16.4090,-71.5375",

    "Reino Unido|Londres": "51.5074,-0.1278",
    "Reino Unido|Manchester": "53.4808,-2.2426",

    "Francia|París": "48.8566,2.3522",
    "Francia|Lyon": "45.7640,4.8357",

    "Alemania|Berlín": "52.5200,13.4050",
    "Alemania|Múnich": "48.1351,11.5820",

    "Italia|Roma": "41.9028,12.4964",
    "Italia|Milán": "45.4642,9.1900",

    "Canadá|Ottawa": "45.4215,-75.6972",
    "Canadá|Toronto": "43.6532,-79.3832",

    "Brasil|Brasilia": "-15.7939,-47.8828",
    "Brasil|São Paulo": "-23.5505,-46.6333",
  };

  const locationToKey = (locationStr) => {
    if (!locationStr || typeof locationStr !== "string") return "";
    const parts = locationStr.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return "";
    const city = parts[0];
    const country = parts[parts.length - 1];
    return `${country}|${city}`;
  };

  const toSerpLL = (raw, zoom) => {
    const s = (raw || "").trim();
    if (!s) return "";

    // si ya viene en formato @..., ... ,...z
    if (s.startsWith("@") && s.includes("z")) return s;

    // si viene como lat,lng
    const parts = s.split(",").map(x => x.trim());
    if (parts.length < 2) return "";

    const lat = parts[0];
    const lng = parts[1];
    return `@${lat},${lng},${zoom}z`;
  };

  try {
    const body = req.body || {};

    const apiKey = body.apiKey;
    const q = body.q;

    const num = Number(body.num ?? 10);
    const start = Number(body.start ?? 0);

    const location = (body.location || "Chile").toString();

    // z SOLO se usa si NO hay ll
    const z = Number(body.z ?? 14);

    // ll puede venir desde frontend
    let ll = (typeof body.ll === "string" ? body.ll.trim() : "");

    // Si NO viene ll, lo intentamos derivar desde location
    if (!ll) {
      const key = locationToKey(location);
      if (key && CITY_LL_RAW[key]) {
        ll = CITY_LL_RAW[key]; // aquí es "lat,lng"
      }
    }

    if (!apiKey) return res.status(400).json({ error: "Missing apiKey" });
    if (!q) return res.status(400).json({ error: "Missing q" });
    if (!Number.isFinite(num) || num <= 0) return res.status(400).json({ error: "Invalid num" });
    if (!Number.isFinite(start) || start < 0) return res.status(400).json({ error: "Invalid start" });

    let url =
      `https://serpapi.com/search.json` +
      `?engine=google_maps` +
      `&q=${encodeURIComponent(q)}` +
      `&num=${encodeURIComponent(String(num))}` +
      `&start=${encodeURIComponent(String(start))}` +
      `&api_key=${encodeURIComponent(apiKey)}`;

    // ✅ REGLA: ll y z NO juntos
    if (ll) {
      const llFormatted = toSerpLL(ll, 14);
      if (!llFormatted) return res.status(400).json({ error: "Invalid ll format (after formatting)" });
      url += `&ll=${encodeURIComponent(llFormatted)}`;
    } else {
      if (!Number.isFinite(z) || z <= 0) return res.status(400).json({ error: "Invalid z" });
      url += `&location=${encodeURIComponent(location)}`;
      url += `&z=${encodeURIComponent(String(z))}`;
    }

    const r = await fetch(url);
    const text = await r.text();

    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
