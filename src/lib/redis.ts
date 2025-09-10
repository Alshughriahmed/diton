/**
 * Upstash Redis via REST (بدون تبعية). يتطلب:
 * UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */
type Cmd = (string | number)[];
const URL_ = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

export async function redis(cmd: Cmd) {
  if (!URL_ || !TOKEN) throw new Error("Missing Upstash env");
  const res = await fetch(URL_ + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([cmd]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Upstash error " + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data[0].result : data.result;
}

// helpers مبدئية
export const qpush = (k: string, v: string) => redis(["RPUSH", k, v]);
export const qpop  = (k: string) => redis(["LPOP", k]);
export const setex = (k: string, ttl: number, v: string) => redis(["SETEX", k, ttl, v]);
export const get   = (k: string) => redis(["GET", k]);
