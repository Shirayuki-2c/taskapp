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

async function rawCmd(args) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `KV 请求失败: ${res.status}`);
  return data.result;
}

export async function kvGet(key) {
  const v = await cmd(`/get/${encodeURIComponent(key)}`);
  return v ? JSON.parse(v) : null;
}

export function kvSet(key, value) {
  return cmd(`/set/${encodeURIComponent(key)}`, JSON.stringify(value));
}

export async function kvAcquireLock(key, token, ttlSeconds) {
  const result = await rawCmd(["SET", key, token, "EX", ttlSeconds, "NX"]);
  return result === "OK";
}

export function kvReleaseLock(key, token) {
  // 只释放自己持有的锁，避免旧请求误删过期后由新请求取得的锁。
  return rawCmd([
    "EVAL",
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
    1,
    key,
    token,
  ]);
}
