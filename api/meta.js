// GET    /api/meta                          一次性返回 { types, fieldDefs }
// POST   /api/meta?resource=type            新建任务类型
// POST   /api/meta?resource=field           新建自定义字段
// PATCH  /api/meta?resource=type&id=xx      更新类型（归档也走这里：is_archived=true）
// PATCH  /api/meta?resource=field&id=xx     更新字段定义
// DELETE /api/meta?resource=field&id=xx     删除字段定义
// 注意：类型不提供物理删除，只归档——历史任务还引用着它的 record_id
import { requireContext } from "./_lib/context.js";
import { TABLES } from "./_lib/schema.js";
import {
  listAllRecords, createRecord, updateRecord, deleteRecord,
} from "./_lib/feishu.js";

const ALLOWED = {
  type: new Set(TABLES.taskTypes.fields.map((f) => f.name)),
  field: new Set(TABLES.fieldDefs.fields.map((f) => f.name)),
};

function sanitize(kind, body = {}) {
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED[kind].has(k) || v === undefined) continue;
    // fieldDefs 的 options 在表里是文本列，传数组时自动序列化
    out[k] = k === "options" && typeof v !== "string" ? JSON.stringify(v) : v;
  }
  return out;
}

const toItem = (r) => ({ id: r.record_id, ...r.fields });

export default async function handler(req, res) {
  const ctx = await requireContext(req, res);
  if (!ctx) return;
  const { uat } = ctx.session;
  const { appToken, tableIds } = ctx;

  try {
    if (req.method === "GET") {
      const [types, fieldDefs] = await Promise.all([
        listAllRecords(uat, appToken, tableIds.taskTypes),
        listAllRecords(uat, appToken, tableIds.fieldDefs),
      ]);
      return res.json({
        ok: true,
        data: {
          types: types.map(toItem).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
          fieldDefs: fieldDefs.map((r) => {
            const f = toItem(r);
            try { f.options = f.options ? JSON.parse(f.options) : []; }
            catch { f.options = []; }
            return f;
          }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        },
      });
    }

    const resource = req.query.resource;
    if (resource !== "type" && resource !== "field") {
      return res.status(400).json({ ok: false, error: { code: "bad_request", message: "resource 须为 type 或 field" } });
    }
    const tableId = resource === "type" ? tableIds.taskTypes : tableIds.fieldDefs;

    if (req.method === "POST") {
      const fields = sanitize(resource, req.body);
      if (!fields.name) {
        return res.status(400).json({ ok: false, error: { code: "bad_request", message: "name 必填" } });
      }
      if (resource === "field" && !fields.type_id) {
        return res.status(400).json({ ok: false, error: { code: "bad_request", message: "field 必须挂在某个 type_id 下" } });
      }
      const record = await createRecord(uat, appToken, tableId, fields);
      return res.json({ ok: true, data: toItem(record) });
    }

    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: { code: "bad_request", message: "缺少 id" } });
    }

    if (req.method === "PATCH") {
      await updateRecord(uat, appToken, tableId, id, sanitize(resource, req.body));
      return res.json({ ok: true, data: { id } });
    }

    if (req.method === "DELETE") {
      if (resource === "type") {
        return res.status(400).json({ ok: false, error: { code: "bad_request", message: "类型只能归档，不能删除" } });
      }
      await deleteRecord(uat, appToken, tableId, id);
      return res.json({ ok: true, data: { id } });
    }

    return res.status(405).json({ ok: false, error: { code: "method_not_allowed", message: req.method } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: { code: "feishu_error", message: e.message } });
  }
}