export type RestCfg = { url?: string; token?: string };
const url = process.env.UPSTASH_REDIS_REST_URL || "";
const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const have = Boolean(url && token);
async function up(method: string, path: string) {
  const u = `${url.replace(/\/+$/,"")}/${path.replace(/^\/+/,"")}`;
  const r = await fetch(u, { method, headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`redis ${method} ${path} ${r.status}`);
  return r;
}
export async function rPing() { if (!have) return { ok:false, env:false }; try { const p = await up("GET","ping").then(x=>x.text()); return { ok:p==="PONG", env:true }; } catch { return { ok:false, env:true }; } }
export async function rSet(key: string, val: string, sec = 300) {
  if (!have) return { ok:false, env:false };
  await up("GET", `set/${encodeURIComponent(key)}/${encodeURIComponent(val)}?EX=${sec}`);
  return { ok:true, env:true };
}
export async function rGet(key: string) {
  if (!have) return { ok:false, env:false, value:null as string|null };
  const txt = await up("GET", `get/${encodeURIComponent(key)}`).then(x=>x.text());
  return { ok:true, env:true, value: txt === "null" ? null : txt };
}
export async function rLPush(key: string, v: string) {
  if (!have) return { ok:false, env:false };
  await up("GET", `lpush/${encodeURIComponent(key)}/${encodeURIComponent(v)}`);
  return { ok:true, env:true };
}
export async function rLPop(key: string) {
  if (!have) return { ok:false, env:false, value:null as string|null };
  const txt = await up("GET", `lpop/${encodeURIComponent(key)}`).then(x=>x.text());
  return { ok:true, env:true, value: txt === "null" ? null : txt };
}
export async function rLLen(key: string) {
  if (!have) return { ok:false, env:false, len:0 };
  const n = await up("GET", `llen/${encodeURIComponent(key)}`).then(x=>x.text());
  return { ok:true, env:true, len: Number(n)||0 };
}

// compatibility re-exports for existing imports
export const setex = rSet;
export const get = rGet;
