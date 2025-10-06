import { NextRequest, NextResponse } from "next/server";
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
export const preferredRegion = ["fra1", "iad1"];

function __noStore(res: any) {
  try { res.headers?.set?.("Cache-Control", "no-store"); } catch {}
  return res;
}

export async function OPTIONS() {
  return __noStore(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const reqId = req.headers.get("x-req-id") || crypto.randomUUID();

  try {
    // تنظيف الأشباح عند كل enqueue
    cleanupGhosts().catch(() => {});

    // استخرج anon من الـcookie
    const raw =
      req.headers.get("cookie")?.match(/(?:^|;\s*)anon=([^;]+)/)?.[1] ?? null;

    const anonId = raw ? verifySigned(raw, process.env.ANON_SIGNING_SECRET!) : null;
    if (!anonId) {
      logRTC({ route: "/api/rtc/enqueue", reqId, ms: Date.now() - start, status: 403, note: "no-anon" });
      return __noStore(jsonEcho(req, { error: "anon-required" }, { status: 403 }));
    }

    const b: any = await req.json().catch(() => ({}));
    const gender = String(b.gender ?? "u").toLowerCase();
    const country = String(b.country ?? req.headers.get("x-vercel-ip-country") ?? "XX").toUpperCase();
    const filterGenders = String(b.filterGenders ?? "all");
    const filterCountries = String(b.filterCountries ?? "ALL");

    await enqueue(anonId, { gender, country }, { genders: filterGenders, countries: filterCountries });

    // VIP: تقدّم في الصف
    try {
      const isVip = await requireVip();
      if (isVip) {
        const pri = Date.now() - 600_000; // 10 دقائق
        await Promise.all([
          zadd(`rtc:q`, pri, anonId),
          zadd(`rtc:q:gender:${gender}`, pri, anonId),
          zadd(`rtc:q:country:${country}`, pri, anonId),
        ]);
      }
    } catch {}

    logRTC({ route: "/api/rtc/enqueue", reqId, ms: Date.now() - start, status: 204, note: "enqueued" });
    return __noStore(new NextResponse(null, { status: 204 }));
  } catch (e: any) {
    logRTC({ route: "/api/rtc/enqueue", reqId, ms: Date.now() - start, status: 500, note: String(e?.message || e).slice(0, 100) });
    return __noStore(
      jsonEcho(req, { error: "enqueue-fail", info: String(e?.message || e).slice(0, 140) }, { status: 500 })
    );
  }
}
