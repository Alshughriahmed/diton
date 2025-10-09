// src/app/api/rtc/enqueue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  optionsHandler,
  withCommon,
  logEvt,
  getAnonOrThrow,
  normalizeAttrs,
  normalizeFilters,
  kAttrs, kFilters, kPairMap, kClaim, kLast, // مفاتيح ضمن نطاقكم
  rjson,
} from "../_lib";
import { set as rSet, del as rDel, expire as rExpire } from "@/lib/rtc/upstash";
import { zadd as rZadd } from "@/lib/rtc/upstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"]; // بدون as const

export async function OPTIONS(_req: NextRequest) {
  await cookies();
  return optionsHandler(_req);
}

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-req-id") || "";
  const t0 = Date.now();

  try {
    await cookies(); // التزام القاعدة
    const anon = await getAnonOrThrow(req);

    // خصائص/مرشحات مع افتراضيات آمنة
    const body = await req.json().catch(() => ({}));
    const attrs = normalizeAttrs(body);          // {gender:"m|f|u", country:"XX", ts}
    const filters = normalizeFilters(body);      // {filterGenders:"all"|[], filterCountries:"ALL"|[], ts}

    // تنظيف خرائط قديمة قبل الإدراج
    await Promise.allSettled([
      rDel(kPairMap(anon)),
      rDel(kClaim(anon)),
    ]);

    // اكتب attrs/filters مع TTL واقعي، ثم أدرِج في الطابور العام وفق نطاقنا
    await Promise.all([
      rSet(kAttrs(anon), JSON.stringify(attrs)),
      rExpire(kAttrs(anon), 180),
      rSet(kFilters(anon), JSON.stringify(filters)),
      rExpire(kFilters(anon), 180),
      rZadd("rtc:q", Date.now(), anon),
      rSet(kLast(anon), JSON.stringify({ ts: Date.now(), note: "enqueue" })),
      rExpire(kLast(anon), 600),
    ]);

    logEvt({ route: "/api/rtc/enqueue", status: 200, rid, anonId: anon, phase: "enqueue", note: "ok" });
    return rjson(req, { ok: true }, 200);
  } catch (e: any) {
    logEvt({ route: "/api/rtc/enqueue", status: 401, rid, phase: "auth|parse", note: String(e?.message || e) });
    // لا نُرجع تفاصيل إضافية
    return withCommon(NextResponse.json({ error: "enqueue-failed" }, { status: 401 }), rid);
  } finally {
    logEvt({ route: "/api/rtc/enqueue", status: 200, rid, note: `ms=${Date.now() - t0}` });
  }
}


