import crypto from "node:crypto";
import { readSession } from "./_lib/session.js";
import { kvAcquireLock, kvGet, kvReleaseLock, kvSet } from "./_lib/kv.js";
import * as fs from "./_lib/feishu.js";
import {
  TABLES, SCHEMA_VERSION, BASE_NAME, MARKER_TABLE, DEFAULT_TYPES,
} from "./_lib/schema.js";

export default async function handler(req, res) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  const { uat, openId } = session;
  const lockKey = `bootstrap:lock:${openId}`;
  const lockToken = crypto.randomUUID();
  let hasLock = false;

  try {
    hasLock = await kvAcquireLock(lockKey, lockToken, 120);
    if (!hasLock) {
      return res.status(202).json({ ok: true, data: { status: "initializing" } });
    }

    // 1. KV 直达：查门牌号并验证仍然有效
    const cached = await kvGet(`base:${openId}`);
    let appToken = cached?.appToken || null;
    if (appToken && !(await isAlive(uat, appToken))) appToken = null;

    // 2. 自愈：KV 失效则扫描云空间，靠标记表认领
    if (!appToken) appToken = await scanForBase(uat);

    // 3. 全新用户：创建
    let isNew = false;
    if (!appToken) {
      appToken = await fs.createBase(uat, BASE_NAME);
      isNew = true;
    }

    // 4. 体检：对照 schema，缺表补表、缺字段补字段（只增不删）
    const mapping = await ensureSchema(uat, appToken);

    // 5. 新用户播种默认模板
    if (isNew) await seedDefaults(uat, appToken, mapping);

    // 6. 回写 KV
    await kvSet(`base:${openId}`, { appToken, ...mapping, schemaVersion: SCHEMA_VERSION });

    return res.json({ appToken, ...mapping, isNew });
  } catch (e) {
    return res.status(500).json({ error: "bootstrap_failed", detail: e.message });
  } finally {
    if (hasLock) {
      try {
        await kvReleaseLock(lockKey, lockToken);
      } catch {
        // 锁仍会在 120 秒后自动过期，释放失败不覆盖 bootstrap 的真实结果。
      }
    }
  }
}

async function isAlive(uat, appToken) {
  try {
    await fs.listTables(uat, appToken);
    return true;
  } catch {
    return false;
  }
}

// 扫描根目录的所有多维表格，含标记表者即认领（文件名随便改都能找回）
async function scanForBase(uat) {
  let files;
  try {
    files = await fs.listDriveFiles(uat);
  } catch {
    return null; // 无 drive 权限时静默跳过，走新建
  }
  for (const f of files.filter((f) => f.type === "bitable")) {
    try {
      const tables = await fs.listTables(uat, f.token);
      if (tables.some((t) => t.name === MARKER_TABLE)) return f.token;
    } catch { /* 单个文件读不了就跳过 */ }
  }
  return null;
}

async function ensureSchema(uat, appToken) {
  const existing = await fs.listTables(uat, appToken);
  const tableIds = {};
  const fieldIds = {};

  for (const def of Object.values(TABLES)) {
    let table = existing.find((t) => t.name === def.name);
    const tableId = table
      ? table.table_id
      : await fs.createTable(uat, appToken, def); // 建表时字段一并建好
    tableIds[def.key] = tableId;

    // 字段体检：以 field_id 为准落图，缺失的按名字补建
    const fields = await fs.listFields(uat, appToken, tableId);
    const byName = Object.fromEntries(fields.map((f) => [f.field_name, f.field_id]));
    fieldIds[def.key] = {};
    for (const fdef of def.fields) {
      if (!byName[fdef.name]) {
        const created = await fs.createField(uat, appToken, tableId, fdef);
        byName[fdef.name] = created.field.field_id;
      }
      fieldIds[def.key][fdef.name] = byName[fdef.name];
    }
  }

  return { tableIds, fieldIds };
}

async function seedDefaults(uat, appToken, { tableIds }) {
  // 标记表写入版本信息（自愈识别 + 未来升级判断都靠它）
  await fs.createRecord(uat, appToken, tableIds.meta, {
    key: "schema_version",
    value: String(SCHEMA_VERSION),
  });

  for (const t of DEFAULT_TYPES) {
    const rec = await fs.createRecord(uat, appToken, tableIds.taskTypes, {
      name: t.name, icon: t.icon, color: t.color,
      sort_order: t.sort_order, is_archived: false,
    });
    for (const f of t.fields) {
      await fs.createRecord(uat, appToken, tableIds.fieldDefs, {
        type_id: rec.record_id,
        name: f.name,
        field_type: f.field_type,
        options: f.options ? JSON.stringify(f.options) : "",
        required: false,
        sort_order: f.sort_order,
      });
    }
  }
}
