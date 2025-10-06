// src/app/api/rtc/matchmake/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jsonEcho } from "@/lib/api/xreq";
import { logRTC } from "@/lib/rtc/logger";
import { verifySigned } from "@/lib/rtc/auth";
import { matchmake } from "@/lib/rtc/mm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

const __noStore = <T extends Response>(r: T): T => {
  try { (r as any).headers?.set?.("Cache-Control", "no-store"); } catch {}
  return r;
};

export async function OPTIONS() {
  return __noStore(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const reqId = req.headers.get("x-req-id") || crypto.randomUUID();

  try {
    // استخرج anon من الكوكي (أو من رأس Cookie كاحتياط)
    const cookieStore = cookies(); // لا تستخدم await
    const raw =
      cookieStore.get("anon")?.value ??
      req.headers.get("cookie")?.match(/(?:^|;\s*)anon=([^;]+)/)?.[1] ??
      null;

    const anonId = raw ? verifySigned(raw, process.env.ANON_SIGNING_SECRET!) : null;
    if (!anonId) {
      logRTC({ route: "/api/rtc/matchmake", reqId, ms: Date.now() - t0, status: 401, note: "no-anon" });
      return __noStore(jsonEcho(req, { error: "matchmake-fail", info: "no-anon" }, { status: 401 }));
    }

    // بارس اختياري (لا نعتمد عليه لكي لا نكسر التوافق)
    const body: any = await req.json().catch(() => ({}));
    const hint = {
      gender: (body.gender ?? "").toString().toLowerCase() || undefined,
      country: (body.country ?? "").toString().toUpperCase() || undefined,
      filterGenders: (body.filterGenders ?? "").toString() || undefined,
      filterCountries: (body.filterCountries ?? "").toString() || undefined,
    };

    // نفّذ الملاءمة
    let out: any = null;
    try {
      // كثير من المشاريع تُصدّر matchmake(anonId, hint?) — نجرب تمريـر hint إن وُجد
      out = await (matchmake as any)(anonId, hint);
    } catch (e) {
      // إن كان التوقيع مختلفًا، جرّب الاستدعاء البسيط
      try { out = await (matchmake as any)(anonId); } catch {}
    }

    // إذا لم توجد نتيجة صريحة نعيد 204
    if (!out || out === true) {
      logRTC({ route: "/api/rtc/matchmake", reqId, ms: Date.now() - t0, status: 204, note: "no-match-yet" });
      return __noStore(new NextResponse(null, { status: 204 }));
    }

    // نجاح مع payload
    logRTC({ route: "/api/rtc/matchmake", reqId, ms: Date.now() - t0, status: 200, note: "matched" });
    return __noStore(jsonEcho(req, { ok: true, result: out }, { status: 200 }));
  } catch (e: any) {
    logRTC({
      route: "/api/rtc/matchmake",
      reqId,
      ms: Date.now() - t0,
      status: 500,
      note: String(e?.message || e).slice(0, 100),
    });
    return __noStore(
      jsonEcho(req, { error: "matchmake-fail", info: String(e?.message || e).slice(0, 140) }, { status: 500 })
    );
  }
}
