// DataAdapter 的飞书实现。未来独立部署时，写一个同名接口的 Postgres 版替换即可。
const BASE = "https://open.feishu.cn/open-apis";

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.code !== 0) {
    const err = new Error(`feishu ${path}: ${json.code} ${json.msg}`);
    err.feishuCode = json.code;
    throw err;
  }
  return json.data;
}

// ---------- 身份 ----------
async function getAppAccessToken() {
  const res = await fetch(`${BASE}/auth/v3/app_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`app_access_token: ${json.msg}`);
  return json.app_access_token;
}

export async function exchangeCode(code) {
  const aat = await getAppAccessToken();
  return call("/authen/v1/oidc/access_token", {
    method: "POST",
    token: aat,
    body: { grant_type: "authorization_code", code },
  }); // → { access_token, expires_in, ... }
}

export function getUserInfo(uat) {
  return call("/authen/v1/user_info", { token: uat });
}

// ---------- 多维表格 ----------
export async function createBase(uat, name) {
  const d = await call("/bitable/v1/apps", {
    method: "POST", token: uat, body: { name, folder_token: "" },
  });
  return d.app.app_token;
}

export async function listTables(uat, appToken) {
  const d = await call(`/bitable/v1/apps/${appToken}/tables?page_size=100`, { token: uat });
  return d.items || [];
}

export async function createTable(uat, appToken, { name, fields }) {
  const d = await call(`/bitable/v1/apps/${appToken}/tables`, {
    method: "POST", token: uat,
    body: {
      table: {
        name,
        fields: fields.map((f) => ({
          field_name: f.name, type: f.type,
          ...(f.property ? { property: f.property } : {}),
        })),
      },
    },
  });
  return d.table_id;
}

export async function listFields(uat, appToken, tableId) {
  const d = await call(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=100`,
    { token: uat }
  );
  return d.items || [];
}

export function createField(uat, appToken, tableId, f) {
  return call(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
    method: "POST", token: uat,
    body: {
      field_name: f.name, type: f.type,
      ...(f.property ? { property: f.property } : {}),
    },
  });
}

export async function createRecord(uat, appToken, tableId, fields) {
  const d = await call(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
    method: "POST", token: uat, body: { fields },
  });
  return d.record;
}

export function updateRecord(uat, appToken, tableId, recordId, fields) {
  return call(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, {
    method: "PUT", token: uat, body: { fields },
  });
}

export function deleteRecord(uat, appToken, tableId, recordId) {
  return call(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, {
    method: "DELETE", token: uat,
  });
}

export async function listAllRecords(uat, appToken, tableId) {
  let items = [], pageToken = "";
  do {
    const d = await call(
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=500&page_token=${pageToken}`,
      { token: uat }
    );
    items = items.concat(d.items || []);
    pageToken = d.has_more ? d.page_token : "";
  } while (pageToken);
  return items;
}

// ---------- 云空间（自愈扫描用） ----------
export async function listDriveFiles(uat, folderToken = "") {
  const d = await call(
    `/drive/v1/files?page_size=200&folder_token=${folderToken}`,
    { token: uat }
  );
  return d.files || [];
}