// src/app/api/rtc/enqueue/route.ts
import { jsonEcho } from "@/lib/api/xreq";
import { logRTC } from "@/lib/rtc/logger";
import { cleanupGhosts } from "@/lib/rtc/queue";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySigned } from "@/lib/rtc/auth";
import { enqueue } from "@/lib/rtc/mm";
import { zadd } from "@/lib/rtc/upstash";
import { requireVip } from "@/utils/vip";

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

// (اختياري) أدوات Upstash صغيرة لاستعمالات مستقبلية
async function upstashPipeline(cmds: any[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(cmds),
    cache: "no-store",
  }).catch(() => null);
  return r ? await r.json().catch(() => null) : null;
}
async function saveUserMetaUpstash(anonId: string, meta: any) {
  try {
    if (!anonId) return;
    const key = `rtc:user:${anonId}`;
    const ttlMs = 120000;
    await upstashPipeline([
      ["HSET", key, "meta", JSON.stringify(meta || {})],
      ["PEXPIRE", key, String(ttlMs)],
    ]);
  } catch {}
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const reqId = req.headers.get("x-req-id") || crypto.randomUUID();

  try {
    // نظّف الأشباح بشكلٍ خفيف
    cleanupGhosts().catch(() => {});

    // استخرج anon من الكوكي أو من رأس Cookie
    const cookieStore = await cookies();
    const raw =
      cookieStore.get("anon")?.value ??
      req.headers.get("cookie")?.match(/(?:^|;\s*)anon=([^;]+)/)?.[1] ??
      null;

    const anonId = raw ? verifySigned(raw, process.env.ANON_SIGNING_SECRET!) : null;
    if (!anonId) {
      logRTC({ route: "/api/rtc/enqueue", reqId, ms: Date.now() - start, status: 500, note: "no-anon" });
      return __noStore(
        jsonEcho(req, { error: "enqueue-fail", info: "no-anon" }, { status: 500 })
      );
    }

    // مدخلات اختيارية
    const b: any = await req.json().catch(() => ({}));
    const gender = String(b.gender || "u").toLowerCase();
    const country = String(b.country || req.headers.get("x-vercel-ip-country") || "XX").toUpperCase();
    const filterGenders = String(b.filterGenders || "all");
    const filterCountries = String(b.filterCountries || "ALL");

    // أدخل الطابور
    await enqueue(anonId, { gender, country }, { genders: filterGenders, countries: filterCountries });

    // أولوية VIP إلى الأمام
    try {
      const isVip = await requireVip();
      if (isVip) {
        const pri = Date.now() - 600_000; // -10m
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
    logRTC({
      route: "/api/rtc/enqueue",
      reqId,
      ms: Date.now() - start,
      status: 500,
      note: String(e?.message || e).slice(0, 100),
    });
    return __noStore(
      jsonEcho(
        req,
        { error: "enqueue-fail", info: String(e?.message || e).slice(0, 140) },
        { status: 500 }
      )
    );
  }
}
