type EnqueueOpts = { vip?: boolean; meta?: Record<string, unknown> };
type DeqItem = { id: string; meta?: Record<string, unknown>; score: number };

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = !!URL && !!TOK;

const KEYS = {
  WAIT: "rtc:wait",                 // ZSET: member=id, score=ms
  META: (id: string) => `rtc:meta:${id}`, // JSON meta (H/MGET not needed; simple GET/SET ok)
  LOCK: (pairId: string) => `rtc:lock:${pairId}`, // SETNX lock
};

const NOW = () => Date.now();
const VIP_BOOST_MS = 800;       // يُنقص من score لجعل VIP يتقدّم بلا كسر FIFO كثيرًا
const GHOST_MAX_AGE_MS = 30_000; // عمر انتظار يعتبر شبحًا

async function rget(path: string){
  const r = await fetch(`${URL}/${path}`, { headers:{Authorization:`Bearer ${TOK}`} }).catch(()=>null as any);
  return r?.ok ? r.json().catch(()=>null) : null;
}
async function rpost(path: string, body: string){
  const r = await fetch(`${URL}/${path}`, { method:'POST', headers:{Authorization:`Bearer ${TOK}`}, body }).catch(()=>null as any);
  return r?.ok ? r.json().catch(()=>null) : null;
}

// In-mem fallback (best-effort only)
const memZ: Array<{id:string,score:number}> = [];
const memMeta = new Map<string,string>();
const memLocks = new Map<string, number>();

export async function qlen(): Promise<number> {
  if (!hasRedis) return memZ.length;
  const j = await rget(`zcard/${KEYS.WAIT}`);
  return Number(j?.result ?? 0);
}

export async function enqueue(id: string, opts: EnqueueOpts = {}): Promise<number> {
  const now = NOW();
  const score = now - (opts.vip ? VIP_BOOST_MS : 0);
  const metaStr = opts.meta ? JSON.stringify(opts.meta) : "";

  if (!hasRedis) {
    memZ.push({id, score}); memZ.sort((a,b)=>a.score-b.score);
    if (metaStr) memMeta.set(KEYS.META(id), metaStr);
    return memZ.findIndex(x=>x.id===id)+1;
  }

  if (metaStr) await rpost(`set/${encodeURIComponent(KEYS.META(id))}/${encodeURIComponent(metaStr)}`,"");
  await rpost(`zadd/${KEYS.WAIT}/${score}/${encodeURIComponent(id)}`,"");
  const j = await rget(`zrank/${KEYS.WAIT}/${encodeURIComponent(id)}`);
  return (j?.result ?? 0) + 1;
}

export async function dequeue(): Promise<DeqItem|null> {
  if (!hasRedis) {
    const item = memZ.shift(); if (!item) return null;
    const meta = memMeta.get(KEYS.META(item.id)); if (meta) memMeta.delete(KEYS.META(item.id));
    return { id: item.id, meta: meta ? safeJSON(meta) : undefined, score: item.score };
  }
  const j = await rget(`zpopmin/${KEYS.WAIT}/1`);
  const arr = j?.result as any[] | undefined;
  if (!arr || !arr.length) return null;
  const [id, score] = arr[0];
  const meta = await rget(`get/${encodeURIComponent(KEYS.META(id))}`);
  if (meta?.result) await rget(`del/${encodeURIComponent(KEYS.META(id))}`);
  return { id, meta: meta?.result ? safeJSON(meta.result) : undefined, score: Number(score) };
}

export async function lockPair(pairId: string, ttlSec = 5): Promise<boolean> {
  if (!hasRedis) {
    const now = NOW();
    const exp = memLocks.get(pairId) || 0;
    if (exp > now) return false;
    memLocks.set(pairId, now + ttlSec*1000);
    return true;
  }
  const j = await rget(`set/${encodeURIComponent(KEYS.LOCK(pairId))}/1?NX=1&EX=${ttlSec}`);
  return j?.result === "OK";
}

export async function ghostCleanup(nowMs = NOW()): Promise<number> {
  if (!hasRedis) {
    const before = memZ.length;
    const keep = memZ.filter(x => nowMs - x.score <= GHOST_MAX_AGE_MS);
    memZ.length = 0; memZ.push(...keep);
    return before - keep.length;
  }
  const cutoff = nowMs - GHOST_MAX_AGE_MS;
  // ZREMRANGEBYSCORE wait -inf (cutoff-1)
  const j = await rget(`zremrangebyscore/${KEYS.WAIT}/-inf/${cutoff}`);
  return Number(j?.result ?? 0);
}

function safeJSON(s: string){ try { return JSON.parse(s); } catch { return undefined; } }


export type QueueStats = { wait: number; ghosts?: number; pairs: number; ts: number };



export async function getQueueStats(nowMs:number = Date.now()): Promise<QueueStats> {
  try {
    const wait = await qlen();

    // ghosts: تقدير العناصر الأقدم من 30s إن توفر Redis
    let ghosts = 0;
    try {
      const URL = process.env.UPSTASH_REDIS_REST_URL;
      const TOK = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (URL && TOK) {
        const cutoff = nowMs - 30000;
        const r = await fetch(`${URL}/zcount/rtc:wait/-inf/${cutoff}`, { headers:{Authorization:`Bearer ${TOK}`} }).catch(()=>null);
        const j = r && (r as any).ok ? await (r as any).json().catch(()=>null) : null;
        ghosts = Number(j?.result ?? 0);
      }
    } catch {}

    // pairs: SCAN على rtc:pair:* إن توفر Redis، وإلا 0
    let pairs = 0;
    try {
      const URL = process.env.UPSTASH_REDIS_REST_URL;
      const TOK = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (URL && TOK) {
        let cursor = '0';
        for (let i=0;i<10;i++){ // حد أقصى 10 دورات حماية
          const r = await fetch(`${URL}/scan/${cursor}?match=rtc:pair:*&count=1000`, { headers:{Authorization:`Bearer ${TOK}`} }).catch(()=>null);
          const j = r && (r as any).ok ? await (r as any).json().catch(()=>null) : null;
          const res = j?.result;
          if (!res || !Array.isArray(res) || res.length<2) break;
          cursor = String(res[0] ?? '0');
          const keys = Array.isArray(res[1]) ? res[1] : [];
          pairs += keys.length;
          if (cursor === '0') break;
        }
      }
    } catch {}

    return { wait: Number(wait||0), ghosts, pairs, ts: nowMs };
  } catch {
    return { wait: 0, ghosts: 0, pairs: 0, ts: nowMs };
  }
}

export { ghostCleanup as cleanupGhosts };
