import { Redis } from "@upstash/redis";

let _r: Redis | null = null;

export function getRedis(): Redis {
  if (_r) return _r;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_URL ||
    process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_TOKEN ||
    process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Upstash Redis env");
  _r = new Redis({ url, token });
  return _r;
}
