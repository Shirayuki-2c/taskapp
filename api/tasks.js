// GET    /api/tasks        列出全部任务
// POST   /api/tasks        创建任务（body 为字段对象）
// PATCH  /api/tasks?id=xx  更新任务
// DELETE /api/tasks?id=xx  删除任务
import { requireContext } from "./_lib/context.js";
import { TASK_STATUS } from "./_lib/constants.js";
import { TABLES } from "./_lib/schema.js";
import {
  listAllRecords, createRecord, updateRecord, deleteRecord,
} from "./_lib/feishu.js";

// 只允许 schema 里声明过的字段写入，防止脏数据进表
const ALLOWED = new Set(TABLES.tasks.fields.map((f) => f.name));

function sanitize(body = {}) {
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k) || v === undefined) continue;
    // custom_fields 在表里是文本列，前端传对象时自动序列化
    out[k] = k === "custom_fields" && typeof v !== "string" ? JSON.stringify(v) : v;
  }
  return out;
}

function toTask(record) {
  const t = { id: record.record_id, ...record.fields };
  try { t.custom_fields = t.custom_fields ? JSON.parse(t.custom_fields) : {}; }
  catch { t.custom_fields = {}; }
  return t;
}

export default async function handler(req, res) {
  const ctx = await requireContext(req, res);
  if (!ctx) return;
  const { uat } = ctx.session;
  const { appToken, tableIds } = ctx;

  try {
    if (req.method === "GET") {
      const items = await listAllRecords(uat, appToken, tableIds.tasks);
      const id = req.query.id;
      if (id) {
        const item = items.find((record) => record.record_id === id);
        if (!item) return res.status(404).json({ message: "任务不存在" });
        return res.json({ ok: true, data: toTask(item) });
      }
      return res.json({ ok: true, data: items.map(toTask) });
    }

    if (req.method === "POST") {
      const fields = sanitize(req.body);
      if (!fields.title) {
        return res.status(400).json({ ok: false, error: { code: "bad_request", message: "title 必填" } });
      }
      fields.status ||= TASK_STATUS.TODO;
      const record = await createRecord(uat, appToken, tableIds.tasks, fields);
      return res.json({ ok: true, data: toTask(record) });
    }

    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: { code: "bad_request", message: "缺少 id" } });
    }

    if (req.method === "PATCH") {
      const fields = sanitize(req.body);
      // 状态切到完成时自动盖完成时间戳，切走则清掉
      if (fields.status === TASK_STATUS.DONE) fields.completed_at = Date.now();
      else if (fields.status) fields.completed_at = null;
      await updateRecord(uat, appToken, tableIds.tasks, id, fields);
      return res.json({ ok: true, data: { id } });
    }

    if (req.method === "DELETE") {
      await deleteRecord(uat, appToken, tableIds.tasks, id);
      return res.json({ ok: true, data: { id } });
    }

    return res.status(405).json({ ok: false, error: { code: "method_not_allowed", message: req.method } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: { code: "feishu_error", message: e.message } });
  }
}
