// "use server";
import { NextResponse } from "next/server";

/** Upstash REST config (switch to in-memory if missing) */
const URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
export const MODE: "redis" | "memory" = (URL && TOKEN) ? "redis" : "memory";

/* -------- In-memory fallback -------- */
type Entry = { type: "str"|"hash"|"set"|"zset"|"list"|"ctr"; val: any; exp?: number };
const memStore: Map<string, Entry> = (globalThis as any).__DITO_MEM__ ||= new Map();
const now = () => Date.now();
function alive(key: string): Entry | undefined {
  const e = memStore.get(key);
  if (!e) return;
  if (e.exp && e.exp <= now()) { memStore.delete(key); return; }
  return e;
}
function setE(key: string, e: Entry) { memStore.set(key, e); }
function ensure<T extends Entry["type"]>(key: string, type: T): Entry {
  const e = alive(key);
  if (!e) { const n: Entry = { type, val: (type==="hash"?{}: type==="set"? new Set(): type==="zset"? new Map(): type==="list"? []: 0) }; setE(key, n); return n; }
  if (e.type !== type) { const n: Entry = { type, val: (type==="hash"?{}: type==="set"? new Set(): type==="zset"? new Map(): type==="list"? []: 0) }; setE(key, n); return n; }
  return e;
}

/* -------- Redis pipeline over REST -------- */
type Cmd = (string | number)[];
async function pipe(commands: Cmd[]) {
  if (MODE === "memory") throw new Error("MEMORY_MODE");
  const r = await fetch(`${URL}/pipeline`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`[upstash] ${r.status} ${text}`);
  }
  const json = await r.json();
  return json.map((e: any) => e.result);
}

/** تشخيص اتصال Upstash: يعيد PONG عند النجاح */
export async function pingRedis(): Promise<{ ok:boolean; pong?:string; err?:string }> {
  if (MODE !== "redis") return { ok:false, err:"mode!=redis" };
  try {
    // أمر PING بسيط عبر pipeline
    const res = await pipe([["PING"]]);
    const pong = Array.isArray(res) ? String(res[0]) : String(res);
    return { ok: pong === "PONG", pong };
  } catch (e:any) {
    return { ok:false, err: String(e?.message||e).slice(0,200) };
  }
}

/* -------- Helpers exported (redis | memory) -------- */
export async function setNxPx(key: string, val: string, px: number) {
  if (MODE === "memory") {
    if (alive(key)) return false;
    setE(key, { type:"str", val, exp: now()+px }); return true;
  }
  const [res] = await pipe([["SET", key, val, "NX", "PX", px]]);
  return res === "OK";
}
export async function setPx(key: string, val: string, px: number) {
  if (MODE === "memory") { setE(key, { type:"str", val, exp: now()+px }); return true; }
  const [res] = await pipe([["SET", key, val, "PX", px]]); return res === "OK";
}
export async function set(key: string, val: string) {
  if (MODE === "memory") { setE(key, { type:"str", val }); return true; }
  const [res] = await pipe([["SET", key, val]]); return res === "OK";
}
export async function get(key: string) {
  if (MODE === "memory") { return alive(key)?.val ?? null; }
  const [res] = await pipe([["GET", key]]); return res ?? null;
}
export async function del(key: string) {
  if (MODE === "memory") { memStore.delete(key); return; }
  await pipe([["DEL", key]]);
}
export async function expire(key: string, s: number) {
  if (MODE === "memory") { const e = alive(key); if (e) e.exp = now()+s*1000; return; }
  await pipe([["EXPIRE", key, s]]);
}
export async function exists(key: string) {
  if (MODE === "memory") { return alive(key) ? 1 : 0; }
  const [n] = await pipe([["EXISTS", key]]); return n === 1;
}

/* hashes */
export async function hset(key: string, obj: Record<string, string | number>) {
  if (MODE === "memory") {
    const e = ensure(key, "hash"); for (const [k,v] of Object.entries(obj)) (e.val as any)[k]=String(v); return;
  }
  const flat:(string|number)[]=[]; Object.entries(obj).forEach(([k,v])=>flat.push(k,String(v)));
  await pipe([["HSET", key, ...flat]]);
}
export async function hgetall(key: string): Promise<Record<string,string>> {
  if (MODE === "memory") { return Object.assign({}, (alive(key)?.val||{})); }
  const [arr] = await pipe([["HGETALL", key]]);
  const out: Record<string,string> = {}; if (Array.isArray(arr)) for(let i=0;i<arr.length;i+=2) out[arr[i]]=arr[i+1];
  return out;
}

/* sets */
export async function sadd(key: string, member: string) {
  if (MODE === "memory") { const e=ensure(key,"set"); (e.val as Set<string>).add(member); return; }
  await pipe([["SADD", key, member]]);
}
export async function sismember(key: string, member: string) {
  if (MODE === "memory") { const e=alive(key); return e?.type==="set" && (e.val as Set<string>).has(member) ? 1:0; }
  const [n] = await pipe([["SISMEMBER", key, member]]); return n === 1;
}

/* zsets */
export async function zadd(key: string, score: number, member: string) {
  if (MODE === "memory") { const e=ensure(key,"zset"); (e.val as Map<string,number>).set(member,score); return; }
  await pipe([["ZADD", key, score, member]]);
}
export async function zrem(key: string, member: string) {
  if (MODE === "memory") { const e=alive(key); if (e?.type==="zset") (e.val as Map<string,number>).delete(member); return; }
  await pipe([["ZREM", key, member]]);
}
export async function zcard(key: string) {
  if (MODE === "memory") { const e=alive(key); return e?.type==="zset" ? (e.val as Map<string,number>).size : 0; }
  const [n] = await pipe([["ZCARD", key]]); return Number(n||0);
}
export async function zrange(key: string, start=0, stop=49): Promise<string[]> {
  if (MODE === "memory") {
    const e=alive(key); if (e?.type!=="zset") return [];
    const arr=[... (e.val as Map<string,number>).entries()].sort((a,b)=>a[1]-b[1]).map(([m])=>m);
    return arr.slice(start, stop+1);
  }
  const [res] = await pipe([["ZRANGE", key, start, stop]]);
  return Array.isArray(res)? res: [];
}
function parseScore(s: string){ let excl=false; if (s.startsWith("(")){ excl=true; s=s.slice(1); }
  if (s==="inf"||s==="+inf") return {v:Infinity,excl}; if (s==="-inf") return {v:-Infinity,excl};
  return {v: Number(s), excl};
}
export async function zremrangebyscore(key: string, min: string, max: string) {
  if (MODE === "memory") {
    const e=alive(key); if (e?.type!=="zset") return;
    const {v:mn,excl:exMn}=parseScore(min), {v:mx,excl:exMx}=parseScore(max);
    const z = e.val as Map<string,number>;
    for (const [m,sc] of [...z.entries()]) {
      const geMin = exMn ? sc>mn : sc>=mn;
      const leMax = exMx ? sc<mx : sc<=mx;
      if (geMin && leMax) z.delete(m);
    }
    return;
  }
  await pipe([["ZREMRANGEBYSCORE", key, min, max]]);
}

/* lists */
export async function lpush(key: string, val: string) {
  if (MODE === "memory") { const e=ensure(key,"list"); (e.val as string[]).unshift(val); return; }
  await pipe([["LPUSH", key, val]]);
}
export async function lrange(key: string, start=0, stop=49) {
  if (MODE === "memory") { const e=alive(key); const a=e?.type==="list"?(e.val as string[]):[]; return a.slice(start, stop+1); }
  const [res] = await pipe([["LRANGE", key, start, stop]]); return Array.isArray(res)? res: [];
}
export async function ltrim(key: string, start: number, stop: number) {
  if (MODE === "memory") { const e=alive(key); if (e?.type==="list") e.val=(e.val as string[]).slice(start, stop+1); return; }
  await pipe([["LTRIM", key, start, stop]]);
}

/* simple counter rate limit: limit N/ windowSec */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  if (MODE === "memory") {
    const bucket = `__rl:${key}:${Math.floor(now()/(windowSec*1000))}`;
    const e = ensure(bucket,"ctr"); e.val = Number(e.val||0) + 1; e.exp = now()+windowSec*1000;
    return e.val <= limit;
  }
  const bucket = `rl:${key}:${Math.floor(Date.now()/(windowSec*1000))}`;
  const res = await pipe([["INCR", bucket], ["EXPIRE", bucket, windowSec]]);
  const count = Number(res?.[0] || 0);
  return count <= limit;
}