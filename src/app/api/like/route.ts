// src/app/api/like/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// نستخدم عميل ريدس الخاص بالمطابقة أياً كان اسمه/تصديره
import * as MatchRedisMod from "@/lib/match/redis";
import { toggleEdgeAndCount } from "@/lib/like";

function j(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

const rlKey = (likerDid: string) => `rl:like:${likerDid}`;

// التقط عميل ريدس بغض النظر عن اسم الدالة في ملف المطابقة
function getRedisAny(): any {
  const m: any = MatchRedisMod as any;
  if (typeof m.getRedis === "function") return m.getRedis();
  if (typeof m.redis === "function") return m.redis();
  if (m.default && typeof m.default.getRedis === "function") return m.default.getRedis();
  if (m.default && typeof m.default.redis === "function") return m.default.redis();
  // fallback: قد يصدّر كائن جاهز
  return m.default ?? m;
}

// غلاف بسيط يوفر pipeline([["CMD", ...args], ...]]) فوق عميل ريدس الحالي
function wrapPipeline(raw: any) {
  if (raw && typeof raw.pipeline === "function") {
    return raw; // يدعم pipeline أصلاً
  }
  return {
    // تنفيذ متسلسل بسيط
    async pipeline(cmds: any[][]) {
      const out: Array<{ result: any }> = [];
      for (const c of cmds) {
        const [op, ...args] = c;
        const fn = String(op || "").toLowerCase();
        const f = raw?.[fn];
        // بعض العملاء يُعرِّفون get/set بأحرف كبيرة أيضاً
        const call =
          typeof f === "function"
            ? f.bind(raw)
            : typeof raw?.[op] === "function"
            ? raw[op].bind(raw)
            : null;
        const res = call ? await call(...args) : undefined;
        out.push({ result: res });
      }
      return out;
    },
    // إتاحة الدوال الشائعة لو احتجناها لاحقاً
    get: (...a: any[]) => raw?.get?.(...a),
    set: (...a: any[]) => raw?.set?.(...a),
    incr: (...a: any[]) => raw?.incr?.(...a),
    decr: (...a: any[]) => raw?.decr?.(...a),
    expire: (...a: any[]) => raw?.expire?.(...a),
  };
}

export async function POST(req: NextRequest) {
  try {
    const raw = getRedisAny();
    if (!raw) return j({ error: "redis_unavailable" }, 500);
    const redis = wrapPipeline(raw);

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

    // معدل: 1 طلب/ثانية لكل مستخدم
    await redis.pipeline([
      ["INCR", rlKey(likerDid)],
      ["EXPIRE", rlKey(likerDid), "1", "NX"],
    ]);
    const rlGet = await redis.pipeline([["GET", rlKey(likerDid)]]);
    const hits = Number(rlGet?.[0]?.result ?? 0);
    if (hits > 1) return j({ error: "rate_limited", window: 1, hits }, 429);

    const { liked: newLiked, count } = await toggleEdgeAndCount(
      redis,
      likerDid,
      targetDid,
      liked,
    );

    return j({ liked: newLiked, count });
  } catch (e: any) {
    return j({ error: "server_error", detail: String(e?.message || e) }, 500);
  }
}
