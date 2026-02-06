import crypto from "crypto";
import { kv } from "@vercel/kv";

function json(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Method not allowed" });
    }

    const { user, pass } = await readBody(req);

    const ADMIN_USER = process.env.ADMIN_USER;
    const ADMIN_PASS = process.env.ADMIN_PASS;

    if (!ADMIN_USER || !ADMIN_PASS) {
      return json(res, 500, { error: "Missing ADMIN_USER/ADMIN_PASS in env" });
    }

    if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
      return json(res, 401, { error: "Invalid credentials" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const ttlSeconds = 60 * 60 * 12; // 12 horas

    await kv.set(`admin:session:${token}`, { user: ADMIN_USER, createdAt: Date.now() }, { ex: ttlSeconds });

    return json(res, 200, {
      ok: true,
      token,
      expiresInSeconds: ttlSeconds,
    });
  } catch (err) {
    return json(res, 500, { error: "Server error", details: String(err?.message || err) });
  }
};
