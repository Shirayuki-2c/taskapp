import crypto from "node:crypto";

const KEY = crypto.createHash("sha256").update(process.env.SESSION_SECRET).digest();

export function seal(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export function unseal(token) {
  try {
    const raw = Buffer.from(token, "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", KEY, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const p = JSON.parse(
      Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")
    );
    return p.exp > Date.now() ? p : null; // 过期视为无会话，前端捕获 401 后静默重登
  } catch {
    return null;
  }
}

export function readSession(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)td_session=([^;]+)/);
  return m ? unseal(m[1]) : null;
}

export function sessionCookie(payload) {
  return `td_session=${seal(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
}