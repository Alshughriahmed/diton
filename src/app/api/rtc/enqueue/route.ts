// src/app/api/rtc/enqueue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jsonEcho } from "@/lib/api/xreq";
import { logRTC } from "@/lib/rtc/logger";
import { cleanupGhosts } from "@/lib/rtc/queue";
import { verifySigned } from "@/lib/rtc/auth";
import { enqueue } from "@/lib/rtc/mm";
import { zadd } from "@/lib/rtc/upstash";
import { requireVip } from "@/utils/vip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"]; // بدون as const

function noStoreEcho(req: NextRequest, res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  const rid = req.headers.get("x-req-id");
  if (rid) res.headers.set("x-req-id", rid);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  await cookies(); // التزام القاعدة
  return noStoreEcho(req, new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const rid = req.headers.get("x-req-id") || crypto.randomUUID();

  try {
    await cookies(); // التزام القاعدة

    // تنظيف أشباح خفيف غير حاجز
    cleanupGhosts().catch(() => {});

    // استخراج anon والتحقق
    const anonCookie = (await cookies()).get("anon")?.value
      ?? req.headers.get("cookie")?.match(/(?:^|;\s*)anon=([^;]+)/)?.[1]
      ?? null;
    const anonId = anonCookie ? verifySigned(anonCookie, process.env.ANON_SIGNING_SECRET!) : null;
    if (!anonId) {
      logRTC({ route: "/api/rtc/enqueue", reqId: rid, ms: Date.now()-t0, status: 403, note: "no-anon" });
      return noStoreEcho(req, jsonEcho(req, { error: "anon-required" }, { status: 403 }));
    }

    // قراءة الخصائص مع افتراضيات آمنة
    const b: any = await req.json().catch(() => ({}));
    const gender = String(b.gender ?? "u").toLowerCase();
    const country = String(b.country ?? req.headers.get("x-vercel-ip-country") ?? "XX").toUpperCase();
    const filterGenders = String(b.filterGenders ?? "all");
    const filterCountries = String(b.filterCountries ?? "ALL");

    // كتابة attrs/filters داخليًا وإعادة الإدراج (وظيفة enqueue لدينا تفعل ذلك)
    await enqueue(
      anonId,
      { gender, country },
      { genders: filterGenders, countries: filterCountries }
    );

    // إدراج مراقبة في الصفوف العامة حسب نطاق المشروع
    const now = Date.now();
    await Promise.all([
      zadd("rtc:q", now, anonId),
      zadd(`rtc:q:gender:${gender}`, now, anonId),
      zadd(`rtc:q:country:${country}`, now, anonId),
    ]).catch(() => {});

    // تفضيل VIP بتخفيض score
    try {
      const isVip = await requireVip();
      if (isVip) {
        const pri = now - 600_000; // 10 دقائق
        await Promise.all([
          zadd("rtc:q", pri, anonId),
          zadd(`rtc:q:gender:${gender}`, pri, anonId),
          zadd(`rtc:q:country:${country}`, pri, anonId),
        ]);
      }
    } catch {}

    logRTC({ route: "/api/rtc/enqueue", reqId: rid, ms: Date.now()-t0, status: 204, note: "enqueued" });
    return noStoreEcho(req, new NextResponse(null, { status: 204 }));
  } catch (e: any) {
    logRTC({ route: "/api/rtc/enqueue", reqId: rid, ms: Date.now()-t0, status: 500, note: String(e?.message||e).slice(0,100) });
    return noStoreEcho(
      req,
      jsonEcho(req, { error: "enqueue-fail", info: String(e?.message||e).slice(0,140) }, { status: 500 })
    );
  }
}
