// src/app/api/like/route.ts
import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getRedis } from "@/lib/match/redis"; // NEW
import { toggleEdgeAndCount } from "@/lib/like"; // NEW

function j(body: any, status = 200) {
  const res = new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
  return res;
}

const rlKey = (likerDid: string) => `rl:like:${likerDid}`; // NEW

export async function POST(req: NextRequest) {
  try {
    const redis = getRedis(); // NEW

    const hdrDid = req.headers.get("x-did") || "";
    const likerDid = hdrDid.trim();
    if (!likerDid) return j({ error: "likerDid required (x-did)" }, 400);

    const body = await (async () => {
      try {
        return await req.json();
      } catch {
        return {};
      }
    })();

    const targetDid = String(body?.targetDid || "").trim();
    const liked = Boolean(body?.liked);
    if (!targetDid) return j({ error: "targetDid required" }, 400);
    if (targetDid === likerDid) return j({ error: "self_like_not_allowed" }, 400);

    // Rate limit: 1 req/sec لكل likerDid
    const rl = await redis.pipeline([["INCR", rlKey(likerDid)], ["EXPIRE", rlKey(likerDid), "1", "NX"]]);
    const hits = Number(rl?.[0]?.result ?? 0);
    if (hits > 1) return j({ error: "rate_limited", window: 1, hits }, 429);

    const { liked: newLiked, count } = await toggleEdgeAndCount(redis, likerDid, targetDid, liked); // NEW
    return j({ liked: newLiked, count });
  } catch (e: any) {
    return j({ error: "server_error", detail: String(e?.message || e) }, 500);
  }
}
