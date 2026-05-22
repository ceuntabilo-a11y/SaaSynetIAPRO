import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function json(res: any, status: number, data: object) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readBody(req: any) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: any) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const { to, subject, html } = await readBody(req) as any;

    if (!to || !subject || !html) {
      return json(res, 400, { error: "Faltan campos: to, subject, html" });
    }

    // Versión texto plano para evitar spam
    const text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s{2,}/g, "\n")
      .trim();

    const { data, error } = await resend.emails.send({
      from: "SynetIA <hola@synetia.site>",
      reply_to: "agencia@synetia.cloud",
      to: [to],
      subject,
      html,
      text,
    });

    if (error) return json(res, 500, { error: error.message });

    return json(res, 200, { ok: true, id: data?.id });
  } catch (err: any) {
    return json(res, 500, { error: String(err?.message || err) });
  }
}
