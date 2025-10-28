//#### src/app/api/like/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import * as MatchRedisMod from "@/lib/match/redis";
import * as LikeMod from "@/lib/like";

function j(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function getRedisAny(): any {
  const m: any = MatchRedisMod as any;
  if (typeof m.getRedis === "function") return m.getRedis();
  if (typeof m.redis === "function") return m.redis();
  if (m.default && typeof m.default.getRedis === "function") return m.default.getRedis();
  if (m.default && typeof m.default.redis === "function") return m.default.redis();
  return m.default ?? m;
}

const rlKey = (likerDid: string) => `rl:like:${likerDid}`;

export async function GET() {
  // ممنوع القراءة عبر GET.
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

    // خنق 1 طلب/ث لكل DID: INCR ثم EXPIRE 1 (NX منطقياً بإعداده عند الضربة الأولى فقط).
    const key = rlKey(likerDid);
    const hits = Number(await raw.incr(key));
    if (hits === 1) {
      try {
        // set only on first hit == سلوك NX
        await raw.expire(key, 1);
      } catch {}
    }
    if (hits > 1) return j({ error: "rate_limited", window: 1, hits }, 429);

    const likedVal = body?.liked;
    const isRead = typeof likedVal === "undefined";

    // دوال المكتبة
    const anyLike: any = LikeMod as any;
    const toggleFn =
      anyLike.toggleEdgeAndCount ||
      anyLike.default?.toggleEdgeAndCount ||
      (typeof LikeMod === "object" ? (LikeMod as any).toggleEdgeAndCount : null);

    const readFn =
      anyLike.readEdgeAndCount ||
      anyLike.getEdgeAndCount ||
      anyLike.readAndCount ||
      anyLike.default?.readEdgeAndCount ||
      anyLike.default?.getEdgeAndCount ||
      anyLike.default?.readAndCount ||
      null;

    if (isRead) {
      if (!readFn) return j({ error: "read_not_supported" }, 501);
      const out = await readFn(raw, likerDid, targetDid);
      // out: { liked:boolean, count:number } أو مشابه
      const liked = Boolean(out?.liked);
      const count = Number(out?.count ?? 0);
      return j({ liked, count, you: liked });
    }

    if (typeof likedVal !== "boolean") return j({ error: "liked_boolean_required" }, 400);
    if (!toggleFn) return j({ error: "toggle_not_supported" }, 501);

    const out = await toggleFn(raw, likerDid, targetDid, likedVal);
    const liked = Boolean(out?.liked);
    const count = Number(out?.count ?? 0);
    return j({ liked, count, you: liked });
  } catch (e: any) {
    return j({ error: "server_error", detail: String(e?.message || e) }, 500);
  }
}
