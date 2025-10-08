// src/app/api/rtc/matchmake/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  optionsHandler,
  withCommon,
  logEvt,
  getAnonOrThrow,
  kAttrs, kPair, kPairMap, kQ,
  pickCandidate,
  createPairAndMap,
  NC, J,
} from "../_lib";
import {
  get as rGet,
  del as rDel,
  zrem as rZrem,
} from "@/lib/rtc/upstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"]; // بدون as const

async function handle(req: NextRequest) {
  await cookies(); // التزام القاعدة
  const rid = req.headers.get("x-req-id") || "";
  const t0 = Date.now();

  try {
    const anon = await getAnonOrThrow();

    // 1) تحقق attrs موجودة وإلا 400 صريحة
    const attrsRaw = (await rGet(kAttrs(anon))) as string | null;
    if (!attrsRaw) {
      logEvt({ route: "/api/rtc/matchmake", status: 400, rid, anonId: anon, note: "no-attrs" });
      return withCommon(NextResponse.json({ error: "no-attrs" }, { status: 400 }), rid);
    }

    // 2) fast-path: خريطة زوج موجودة وصالحة؟
    const mapped = (await rGet(kPairMap(anon))) as string | null;
    if (mapped) {
      const pairStr = (await rGet(kPair(mapped))) as string | null;
      if (pairStr) {
        const pair = JSON.parse(pairStr) as { callerAnon: string; calleeAnon: string };
        let role: "caller" | "callee" | null = null;
        if (pair.callerAnon === anon) role = "caller";
        else if (pair.calleeAnon === anon) role = "callee";
        if (role) {
          logEvt({ route: "/api/rtc/matchmake", status: 200, rid, anonId: anon, pairId: mapped, role, phase: "fast-path", pairExists: true, mapOK: true });
          return withCommon(NextResponse.json({ pairId: mapped, role }, { status: 200 }), rid);
        }
      }
      // خريطة راكدة: احذفها وتابع المسار العادي
      await rDel(kPairMap(anon));
    }

    // 3) اختيار مرشح من الطابور مع قفل claim (يُدار داخل pickCandidate)
    const cand = await pickCandidate(anon);
    if (!cand) {
      logEvt({ route: "/api/rtc/matchmake", status: 204, rid, anonId: anon, phase: "no-candidate" });
      return NC(204, rid);
    }

    // 4) إنشاء زوج وتحديث الخرائط + تنظيف من الطابور
    const { pairId } = await createPairAndMap(anon, cand);
    await Promise.allSettled([
      rZrem(kQ, anon),
      rZrem(kQ, cand),
    ]);

    logEvt({ route: "/api/rtc/matchmake", status: 200, rid, anonId: anon, pairId, role: "caller", phase: "new-pair" });
    return withCommon(NextResponse.json({ pairId, role: "caller", peerAnonId: cand }, { status: 200 }), rid);
  } catch (e: any) {
    logEvt({ route: "/api/rtc/matchmake", status: 401, rid, note: String(e?.message || e) });
    return J(401, { error: "matchmake-failed" }, rid);
  } finally {
    logEvt({ route: "/api/rtc/matchmake", status: 200, rid, note: `ms=${Date.now() - t0}` });
  }
}

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return optionsHandler();
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
