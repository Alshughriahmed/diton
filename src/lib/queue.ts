const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

type Mode = "redis"|"memory";
const hasRedis = Boolean(url && token);
const mode: Mode = hasRedis ? "redis" : "memory";

// in-memory fallback (يُحافظ على الحالة داخل نفس السيرفر)
const g:any = globalThis as any;
g.__ditonaQ = g.__ditonaQ || [];
const memQ: string[] = g.__ditonaQ;

async function rest(cmd: string, ...args: (string|number)[]) {
  if (!hasRedis) throw new Error("no redis");
  const path = [cmd, ...args.map(a=>encodeURIComponent(String(a)))].join("/");
  const res = await fetch(`${url}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`redis ${cmd} ${res.status}`);
  return res.json() as Promise<{ result: any }>;
}

export function queueMode(): Mode { return mode; }

export async function qPush(v: string): Promise<void> {
  if (mode === "redis") { await rest("lpush", "rtc:q", v); return; }
  memQ.push(v);
}
export async function qPop(): Promise<string|null> {
  if (mode === "redis") {
    const r = await rest("rpop", "rtc:q");
    return (r.result ?? null) as any;
  }
  return memQ.length ? memQ.shift()! : null;
}
export async function qLen(): Promise<number> {
  if (mode === "redis") {
    const r = await rest("llen", "rtc:q");
    return Number(r.result || 0);
  }
  return memQ.length;
}
