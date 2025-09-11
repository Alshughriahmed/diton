// Upstash Redis helpers
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

interface UpstashResponse {
  result: any;
}

async function cmd(command: string[]): Promise<any> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error("Missing Upstash credentials");
  }
  
  const res = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  
  if (!res.ok) {
    throw new Error(`Upstash error: ${res.status}`);
  }
  
  const data: UpstashResponse = await res.json();
  return data.result;
}

export async function pipe(commands: string[][]): Promise<any[]> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error("Missing Upstash credentials");
  }
  
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  
  if (!res.ok) {
    throw new Error(`Upstash pipeline error: ${res.status}`);
  }
  
  const data = await res.json();
  return data.map((item: UpstashResponse) => item.result);
}

export async function zadd(key: string, score: number, member: string) {
  return cmd(["ZADD", key, score.toString(), member]);
}

export async function zrem(key: string, member: string) {
  return cmd(["ZREM", key, member]);
}

export async function zremrangebyscore(key: string, min: string, max: string) {
  return cmd(["ZREMRANGEBYSCORE", key, min, max]);
}

export async function zrangebyscore(key: string, min: string, max: string, limit?: number) {
  const args = ["ZRANGEBYSCORE", key, min, max];
  if (limit) {
    args.push("LIMIT", "0", limit.toString());
  }
  return cmd(args);
}

export async function hget(key: string, field: string) {
  return cmd(["HGET", key, field]);
}

export async function hset(key: string, field: string, value: string) {
  return cmd(["HSET", key, field, value]);
}

export async function hdel(key: string, ...fields: string[]) {
  return cmd(["HDEL", key, ...fields]);
}

export async function expire(key: string, seconds: number) {
  return cmd(["EXPIRE", key, seconds.toString()]);
}

export async function del(key: string) {
  return cmd(["DEL", key]);
}

export async function lrange(key: string, start = 0, stop = 49) {
  const [res] = await pipe([["LRANGE", key, start.toString(), stop.toString()]]);
  return Array.isArray(res) ? res : [];
}

export async function lpush(key: string, ...values: string[]) {
  return cmd(["LPUSH", key, ...values]);
}

export async function lpop(key: string) {
  return cmd(["LPOP", key]);
}