import { rLPush, rLPop, rLLen } from "./redis";

const qKey = process.env.RTC_QUEUE_KEY || "rtc:queue:default";
const mem: string[] = [];
const useMem = !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN;

export function queueMode() { return useMem ? "memory" : "redis"; }

export async function qLen() {
  if (useMem) return { mode:"memory", len: mem.length };
  try {
    const { len } = await rLLen(qKey);
    return { mode:"redis", len };
  } catch {
    return { mode:"memory-fallback", len: mem.length };
  }
}
export async function qPush(id: string) {
  if (!id) return await qLen();
  if (useMem) { mem.push(id); return { mode:"memory", len: mem.length }; }
  try {
    await rLPush(qKey, id);
    return await qLen();
  } catch {
    // Fallback to memory on Redis failure
    mem.push(id);
    return { mode:"memory-fallback", len: mem.length };
  }
}
export async function qPop2() {
  if (useMem) {
    const a = mem.shift()||null; const b = mem.shift()||null;
    return { mode:"memory", pair: a && b ? [a,b] : null };
  }
  try {
    const a = (await rLPop(qKey)).value; const b = (await rLPop(qKey)).value;
    return { mode:"redis", pair: (a && b) ? [a,b] : null };
  } catch {
    // Fallback to memory on Redis failure
    const a = mem.shift()||null; const b = mem.shift()||null;
    return { mode:"memory-fallback", pair: a && b ? [a,b] : null };
  }
}
