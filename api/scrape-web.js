export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL requerida" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(200).json({
        ok: false,
        email: null,
        webStatus: "error",
        webSummary: "No se pudo acceder al sitio web",
      });
    }

    const html = await response.text();
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 5000);

    // Extraer emails
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex) || [];
    const filteredEmails = emails.filter(e =>
      !e.includes("example") &&
      !e.includes("sentry") &&
      !e.includes("wix") &&
      !e.includes("schema") &&
      !e.includes("wordpress") &&
      !e.includes("@2x") &&
      !e.includes("png") &&
      !e.includes("jpg")
    );
    const uniqueEmails = [...new Set(filteredEmails)];
    const email = uniqueEmails[0] || null;

    // Analizar calidad básica de la web
    const hasPhone = /(\+?\d[\d\s\-()]{7,})/g.test(html);
    const hasWhatsApp = /whatsapp/i.test(html);
    const hasBooking = /(reserv|cita|agend|booking|appointment)/i.test(html);
    const hasSocialMedia = /(facebook|instagram|twitter|tiktok)/i.test(html);
    const isModern = /(react|vue|angular|next|gatsby)/i.test(html);
    const hasContactForm = /(contact|formulario|form)/i.test(html);

    let webScore = 0;
    if (email) webScore += 2;
    if (hasPhone) webScore += 1;
    if (hasWhatsApp) webScore += 2;
    if (hasBooking) webScore += 2;
    if (hasSocialMedia) webScore += 1;
    if (isModern) webScore += 1;
    if (hasContactForm) webScore += 1;

    let webStatus = "básico";
    if (webScore >= 7) webStatus = "moderno y completo";
    else if (webScore >= 4) webStatus = "funcional";
    else webStatus = "básico o desactualizado";

    const features = [];
    if (hasWhatsApp) features.push("WhatsApp");
    if (hasBooking) features.push("sistema de citas");
    if (hasSocialMedia) features.push("redes sociales");
    if (hasContactForm) features.push("formulario de contacto");
    if (email) features.push("email visible");

    const webSummary = features.length > 0
      ? `Web ${webStatus}. Tiene: ${features.join(", ")}.`
      : `Web ${webStatus}. Sin elementos de contacto digital visibles.`;

    return res.status(200).json({
      ok: true,
      email,
      allEmails: uniqueEmails.slice(0, 3),
      webStatus,
      webSummary,
      hasWhatsApp,
      hasBooking,
      hasSocialMedia,
      webScore,
      textPreview: text.slice(0, 500),
    });

  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(200).json({
        ok: false,
        email: null,
        webStatus: "timeout",
        webSummary: "El sitio tardó demasiado en responder",
      });
    }

    return res.status(200).json({
      ok: false,
      email: null,
      webStatus: "inaccesible",
      webSummary: "No se pudo acceder al sitio web",
    });
  }
}