// 统一上下文：校验会话 + 从 KV 取多维表格的"门牌号"。
// 键名和数据形状与 bootstrap.js 的 kvSet 保持一致：
// base:{openId} → { appToken, tableIds, fieldIds, schemaVersion }
import { readSession } from "./session.js";
import { kvGet } from "./kv.js";

export async function requireContext(req, res) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ ok: false, error: { code: "unauthorized", message: "登录态失效" } });
    return null;
  }
  const ctx = await kvGet(`base:${session.openId}`);
  if (!ctx?.appToken || !ctx?.tableIds) {
    res.status(409).json({ ok: false, error: { code: "need_bootstrap", message: "数据表未初始化" } });
    return null;
  }
  return { session, appToken: ctx.appToken, tableIds: ctx.tableIds, fieldIds: ctx.fieldIds };
}