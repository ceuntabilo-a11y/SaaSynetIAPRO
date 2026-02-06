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

function generate8DigitCode() {
  const n = crypto.randomInt(0, 100000000);
  return String(n).padStart(8, "0");
}

function durationDaysToSeconds(days) {
  return days * 24 * 60 * 60;
}

module.exports = async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (req.method === "POST") {
      const { username, durationDays } = await readBody(req);

      const days = Number(durationDays);
      if (!username || typeof username !== "string") {
        return json(res, 400, { error: "username is required" });
      }
      if (![1, 7, 30].includes(days)) {
        return json(res, 400, { error: "durationDays must be 1, 7, or 30" });
      }

      let code = generate8DigitCode();
      for (let i = 0; i < 5; i++) {
        const exists = await kv.get(`code:${code}`);
        if (!exists) break;
        code = generate8DigitCode();
      }

      const ttlSeconds = durationDaysToSeconds(days);
      const now = Date.now();
      const expiresAt = now + ttlSeconds * 1000;

      const record = {
        code,
        username,
        createdAt: now,
        expiresAt,
        durationDays: days,
      };

      await kv.set(`code:${code}`, record, { ex: ttlSeconds });

      return json(res, 200, { ok: true, record });
    }

    if (req.method === "GET") {
      const items = [];
      for await (const key of kv.scanIterator({ match: "code:*", count: 200 })) {
        const rec = await kv.get(key);
        if (rec) items.push(rec);
      }

      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return json(res, 200, { ok: true, items });
    }

    if (req.method === "DELETE") {
      const { code } = await readBody(req);
      if (!code || typeof code !== "string") {
        return json(res, 400, { error: "code is required" });
      }
      await kv.del(`code:${code}`);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return json(res, 500, { error: "Server error", details: String(err?.message || err) });
  }
};
