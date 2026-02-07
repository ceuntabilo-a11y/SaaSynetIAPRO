import { randomBytes } from "crypto";
import { kv } from "@vercel/kv";

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

// Convierte "SN-GGH2-83TY" -> "SNGGH283TY"
// Convierte "  sn-ggh2-83ty " -> "SNGGH283TY"
function normalizeCode(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeUsername(input) {
  return String(input || "").trim().toLowerCase();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method not allowed" });
    }

    const { username, code } = await readBody(req);

    if (!username || typeof username !== "string") {
      return json(res, 400, { error: "username is required" });
    }
    if (!code || typeof code !== "string") {
      return json(res, 400, { error: "code is required" });
    }

    const rawCode = code.trim(); // "SN-GGH2-83TY"
    const normCode = normalizeCode(code); // "SNGGH283TY"

    // Intentamos ambas llaves por si el admin lo guardó con o sin guiones
    let rec = await kv.get(`code:${normCode}`);
    if (!rec) rec = await kv.get(`code:${rawCode}`);

    if (!rec) {
      return json(res, 401, { error: "Invalid code" });
    }

    const now = Date.now();

    if (rec.expiresAt && now > rec.expiresAt) {
      // borramos ambas por si acaso
      await kv.del(`code:${normCode}`);
      await kv.del(`code:${rawCode}`);
      return json(res, 401, { error: "Code expired" });
    }

    const sessionToken = randomBytes(32).toString("hex");

    const remainingMs = (rec.expiresAt || now) - now;
    const remainingSec = Math.floor(remainingMs / 1000);
    const ttlSeconds = clamp(remainingSec, 60, 30 * 24 * 60 * 60);

    const session = {
      username: normalizeUsername(username),
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
      code: rec.code || rawCode,
    };

    await kv.set(`session:${sessionToken}`, session, { ex: ttlSeconds });

    return json(res, 200, {
      ok: true,
      sessionToken,
      session,
    });
  } catch (err) {
    return json(res, 500, {
      error: "Server error",
      details: String(err?.message || err),
      stack: String(err?.stack || ""),
    });
  }
}