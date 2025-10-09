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
  await cookies(); // القاعدة
  const rid = req.headers.get("x-req-id") || "";
  const t0 = Date.now();

  try {
    const anon = await getAnonOrThrow();

    // 1) وجود attrs إجباري
    const attrsRaw = (await rGet(kAttrs(anon))) as string | null;
    if (!attrsRaw) {
      logEvt({ route: "/api/rtc/matchmake", status: 400, rid, anonId: anon, note: "no-attrs" });
      return withCommon(NextResponse.json({ error: "no-attrs" }, { status: 400 }), rid);
    }

    // 2) fast-path مع تحقق الزوج، وإلا تنظيف الخريطة الراكدة
    const mapped = (await rGet(kPairMap(anon))) as string | null;
    if (mapped) {
      const [pid, role] = String(mapped).split("|");
      const s = (await rGet(kPair(pid))) as string | null;
      if (s && (role === "caller" || role === "callee")) {
        logEvt({ route: "/api/rtc/matchmake", status: 200, rid, anonId: anon, pairId: pid, role: role as any, phase: "fast-path", pairExists: true, mapOK: true });
        return withCommon(NextResponse.json({ pairId: pid, role }, { status: 200 }), rid);
      }
      await rDel(kPairMap(anon)); // خريطة راكدة
    }

    // 3) مرشح من الطابور
    const cand = await pickCandidate(anon);
    if (!cand) {
      logEvt({ route: "/api/rtc/matchmake", status: 204, rid, anonId: anon, phase: "no-candidate" });
      return NC(204, rid);
    }

    // 4) إنشاء الزوج + الخريطتين، ثم إزالة الطرفين من الطابور
    const { pairId } = await createPairAndMap(anon, cand);
    await Promise.allSettled([ rZrem(kQ, anon), rZrem(kQ, cand) ]);

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
export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest)  { return handle(req); }
