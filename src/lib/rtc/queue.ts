// src/lib/rtc/queue.ts
// Queue stats via Upstash. Falls back to in-memory if env missing.

export type QueueStats = {
  wait: number;
  pairs: number;
  qlen?: number;
  vips?: number;
  ghosts_cleaned?: number;
};

const URL = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

const KEY_WAIT = process.env.RTC_QUEUE_ZKEY || "rtc:q";
           // ZSET of waiters: score = ts
const KEY_PAIRS = process.env.RTC_PAIRS_HKEY || "rtc:pairs:active";    // HASH/COUNTER of active pairs
const GHOST_T_SEC = Number(process.env.RTC_GHOST_T_SEC || 45);         // ghost window

// Minimal REST call to Upstash
async function r(cmd: string, ...args: (string | number)[]) {
  if (!URL || !TOKEN) throw new Error("UPSTASH_ENV_MISSING");
  const res = await fetch(`${URL}/${cmd}/${args.map(String).map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`UPSTASH_${cmd}_ERR_${res.status}`);
  return res.json() as Promise<{ result: unknown }>;
}

// In-memory fallback for dev/preview without Upstash
let memZ: number[] = []; // timestamps
let memPairs = 0;

export async function getQueueStats(): Promise<QueueStats> {
  try {
    if (!URL || !TOKEN) {
      // memory mode
      // prune ghosts
      const now = Date.now();
      memZ = memZ.filter((ts) => now - ts < GHOST_T_SEC * 1000);
      return { wait: memZ.length, pairs: memPairs, qlen: memZ.length };
    }

    // ZCARD waiters
    const zcard = await r("zcard", KEY_WAIT);
    const wait = Number((zcard.result as number) || 0);

    // active pairs: use HLEN if hash, else GET number
    let pairs = 0;
    try {
      const hlen = await r("hlen", KEY_PAIRS);
      pairs = Number((hlen.result as number) || 0);
    } catch {
      const get = await r("get", KEY_PAIRS);
      pairs = Number(get.result ?? 0) || 0;
    }

    return { wait, pairs, qlen: wait };
  } catch {
    // don’t break API if Upstash hiccups
    return { wait: 0, pairs: 0 };
  }
}

export async function cleanupGhosts(): Promise<number> {
  try {
    if (!URL || !TOKEN) {
      const before = memZ.length;
      const now = Date.now();
      memZ = memZ.filter((ts) => now - ts < GHOST_T_SEC * 1000);
      return before - memZ.length;
    }
    const nowMs = Date.now();
    const minScore = 0;
    const maxScore = nowMs - GHOST_T_SEC * 1000;
    const res = await r("zremrangebyscore", KEY_WAIT, minScore, maxScore);
    return Number(res.result as number) || 0;
  } catch {
    return 0;
  }
}

export default { getQueueStats, cleanupGhosts };
