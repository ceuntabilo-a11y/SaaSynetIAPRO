import { kv } from "@vercel/kv";
import crypto from "crypto";

function json(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  return await new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function getBearerToken(req) {
  const h = req.headers["authorization"] || "";
  const parts = h.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return null;
}

async function requireAdmin(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    json(res, 401, { error: "Missing admin token" });
    return null;
  }
  const session = await kv.get(`admin:session:${token}`);
  if (!session) {
    json(res, 401, { error: "Invalid/expired admin token" });
    return null;
  }
  return session;
}

// Igual que en verify
function normalizeCode(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/[^A-Z0-9]/g, "");
}

// Genera algo como SN-2MM6-B9MG (visual)
function generatePrettyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0,1,O,I
  const part = (len) => Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `SN-${part(4)}-${part(4)}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method not allowed" });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = await readBody(req);
    const { username, durationDays } = body;

    if (!username || typeof username !== "string") {
      return json(res, 400, { error: "username is required" });
    }

    const d = Number(durationDays);
    if (![1, 7, 30].includes(d)) {
      return json(res, 400, { error: "durationDays must be 1, 7, or 30" });
    }

    const now = Date.now();
    const expiresAt = now + d * 24 * 60 * 60 * 1000;

    const pretty = generatePrettyCode();
    const norm = normalizeCode(pretty);

    const rec = {
      code: pretty,       // lo que ves en pantalla
      codeKey: norm,      // lo que se usa para buscar
      username,
      createdAt: now,
      expiresAt,
      durationDays: d,
    };

    // Guarda por normalizado
    await kv.set(`code:${norm}`, rec, { ex: d * 24 * 60 * 60 });

    return json(res, 200, { ok: true, record: rec });
  } catch (err) {
    return json(res, 500, { error: "Server error", details: String(err?.message || err) });
  }
}
