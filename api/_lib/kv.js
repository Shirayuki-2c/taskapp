const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function cmd(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return (await res.json()).result;
}

export async function kvGet(key) {
  const v = await cmd(`/get/${encodeURIComponent(key)}`);
  return v ? JSON.parse(v) : null;
}

export function kvSet(key, value) {
  return cmd(`/set/${encodeURIComponent(key)}`, JSON.stringify(value));
}