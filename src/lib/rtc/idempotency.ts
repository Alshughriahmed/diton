/**
 * Idempotency for offer/answer keyed by (pairId, role, sdpTag) with TTL.
 * Header-based to avoid consuming body: client should send x-sdp-tag and x-rtc-role.
 * Storage: Upstash if available, else in-memory Map (best-effort).
 */
type Store = { get(k:string):Promise<string|null>; setex(k:string,v:string,ttl:number):Promise<void>; };
const mem = new Map<string, number>();
const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstashGet(key:string){ 
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`,{
    headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`}
  }).then(r=>r.ok?r.json():null).catch(()=>null);
  return res?.result ?? null;
}
async function upstashSetEx(key:string, v:string, ttl:number){
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/setex/${encodeURIComponent(key)}/${ttl}/${encodeURIComponent(v)}`,{
    headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`}
  }).catch(()=>{});
}

const store:Store = hasUpstash ? 
  { get: upstashGet as any, setex: upstashSetEx as any } :
  { get: async (k)=> (mem.get(k) && mem.get(k)!>Date.now()) ? "1" : null,
    setex: async (k,_v,ttl)=> mem.set(k, Date.now()+ttl*1000) };

export async function idemCheck(headers: Headers, ttlSec = 60){
  const pairId = headers.get("x-pair-id") || "";
  const role = headers.get("x-rtc-role") || "";
  const sdpTag = headers.get("x-sdp-tag") || "";
  if (!pairId || !role || !sdpTag) return { ok:true, duplicate:false };

  const key = `idem:${pairId}:${role}:${sdpTag}`;
  const hit = await store.get(key);
  if (hit) return { ok:true, duplicate:true };

  await store.setex(key, "1", Math.max(30, Math.min(ttlSec, 120)));
  return { ok:true, duplicate:false };
}
