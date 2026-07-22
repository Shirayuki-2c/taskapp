import { exchangeCode, getUserInfo } from "./_lib/feishu.js";
import { sessionCookie } from "./_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "missing code" });

  try {
    const t = await exchangeCode(code);
    const user = await getUserInfo(t.access_token);
    res.setHeader(
      "Set-Cookie",
      sessionCookie({
        uat: t.access_token,
        openId: user.open_id,
        exp: Date.now() + (t.expires_in - 300) * 1000, // 提前 5 分钟过期，避免边界
      })
    );
    // 注意：不写任何日志，token 不落盘
    res.json({ name: user.name, avatar: user.avatar_url, openId: user.open_id });
  } catch (e) {
    res.status(500).json({ error: "auth_failed", detail: e.message });
  }
}