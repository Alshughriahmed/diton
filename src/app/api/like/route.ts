// src/app/api/like/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import * as MatchRedisMod from "@/lib/match/redis";
import { toggleEdgeAndCount } from "@/lib/like";

// JSON Response helper
function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

// Get redis instance regardless of export shape
function getRedisAny(): any {
  const m: any = MatchRedisMod as any;
  if (typeof m.getRedis === "function") return m.getRedis();
  if (typeof m.redis === "function") return m.redis();
  if (m.default && typeof m.default.getRedis === "function") return m.default.getRedis();
  if (m.default && typeof m.default.redis === "function") return m.default.redis();
  return m.default ?? m;
}

const rlKey = (likerDid: string) => `rl:like:${likerDid}`;

// Disallow GET to avoid ambiguity
export async function GET() {
  return j({ error: "method_not_allowed" }, 405);
}

export async function POST(req: NextRequest) {
  try {
    const raw = getRedisAny();
    if (!raw) return j({ error: "redis_unavailable" }, 500);

    const likerDid = (req.headers.get("x-did") || "").trim();
    if (!likerDid) return j({ error: "likerDid_required" }, 400);

    const body = await req.json().catch(() => ({} as any));
    const targetDid = String(body?.targetDid || "").trim();
    if (!targetDid) return j({ error: "targetDid_required" }, 400);
    if (targetDid === likerDid) return j({ error: "self_like_not_allowed" }, 400);

    const likedVal = body?.liked;
    if (typeof likedVal !== "boolean") return j({ error: "liked_boolean_required" }, 400);

    // simple 1 req/sec rate limit per liker
    const key = rlKey(likerDid);
    const hits = Number(await raw.incr(key));
    if (hits === 1) {
      try { await raw.expire(key, 1); } catch {}
    }
    if (hits > 1) return j({ error: "rate_limited", window: 1, hits }, 429);

    const { liked, count } = await toggleEdgeAndCount(raw, likerDid, targetDid, likedVal);
    return j({ liked, count });
  } catch (e: any) {
    return j({ error: "server_error", detail: String(e?.message || e) }, 500);
  }
}
