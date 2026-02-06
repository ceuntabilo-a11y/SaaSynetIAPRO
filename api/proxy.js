export default async function handler(req, res) {
  try {
    // Permitir CORS desde tu propio sitio (y también local)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Preflight
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing ?url=" });
    }

    // Seguridad básica: solo permitir http/https
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "Invalid url protocol" });
    }

    // (Opcional pero recomendado) Lista blanca de dominios permitidos
    // Si tu app llama a Google/Apify/n8n, agrega sus dominios aquí:
    const ALLOW = [
      "google.com",
      "googleapis.com",
      "gstatic.com",
      "apify.com",
      "n8n-n8n.8kpnr1.easypanel.host"
    ];

    const hostname = new URL(url).hostname;

    const allowed = ALLOW.some((d) => hostname === d || hostname.endsWith("." + d));
    if (!allowed) {
      return res.status(403).json({ error: `Domain not allowed: ${hostname}` });
    }

    const fetchOptions = {
      method: req.method,
      headers: {
        // Copiamos content-type si viene
        "Content-Type": req.headers["content-type"] || "application/json",
        // Si necesitas Authorization, lo pasamos
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
      }
    };

    // Para POST/PUT/PATCH, reenviar body
    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    }

    const upstream = await fetch(url, fetchOptions);

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    // Devuelve el status real del servidor destino
    const text = await upstream.text();
    return res.status(upstream.status).send(text);
  } catch (err) {
    return res.status(500).json({ error: "Proxy error", details: String(err) });
  }
}
