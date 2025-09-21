export const runtime = "nodejs"; 
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rtc/upstash";
import { extractAnonId } from "@/lib/rtc/auth";

type AllowBody = { pairId?: string|null };

function anonFrom(req: NextRequest): string|null {
  const h = req.headers.get("x-anon");
  if (h) return h;
  try { return req.cookies.get("anon")?.value || null; } catch { return null; }
}

function isVipFrom(req: NextRequest): boolean {
  // Minimal-Diff: نعتمد كوكي vip إن وجدت. لا نغيّر منطق VIP القائم.
  try { return !!req.cookies.get("vip")?.value; } catch { return false; }
}

async function upstashPipeline(cmds: any[]): Promise<any[]|null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  try { return await r.json(); } catch { return null; }
}

export async function POST(req: NextRequest) {
  // FFA fast-path
  if (process.env.FREE_FOR_ALL === "1" || process.env.FREE_FOR_ALL === "true") {
    return NextResponse.json({ ok: true, reason: "ffa" }, { 
      status: 200, 
      headers: { "cache-control": "no-store" } 
    });
  }

  const anon = anonFrom(req);
  const { pairId }: AllowBody = await req.json().catch(()=>({})) as any;

  // رؤوس عدم التخزين
  const hdr = {
    "cache-control": "no-store, no-cache, must-revalidate",
    "referrer-policy": "no-referrer",
  } as Record<string, string>;

  if (!anon || !pairId) {
    return NextResponse.json({ allow: false, reason: "bad-request" }, { status: 400, headers: hdr });
  }

  // FFA: إذا كان مفعلاً، اسمح لجميع المستخدمين
  const ffa = !!(process.env.FREE_FOR_ALL || process.env.NEXT_PUBLIC_FREE_FOR_ALL);
  if (ffa) {
    return NextResponse.json({ allow: true, tier: "ffa" }, { status: 200, headers: hdr });
  }

  // VIP غير محدود
  if (isVipFrom(req)) {
    return NextResponse.json({ allow: true, tier: "vip" }, { status: 200, headers: hdr });
  }

  // غير-VIP: حد 15 رسالة لكل (pairId, anon) خلال 30 دقيقة
  const key = `msg:cnt:${pairId}:${anon}`;
  const pipeline = [
    ["INCR", key],
    ["EXPIRE", key, "1800"], // 30m
  ];

  const out = await upstashPipeline(pipeline);
  const cnt = Number(out?.[0]?.result ?? NaN);

  if (!Number.isFinite(cnt)) {
    // إذا لم تتوفر Upstash نسمح افتراضيًا ولا نكسر التجربة
    return NextResponse.json({ allow: true, tier: "free", degraded: true }, { status: 200, headers: hdr });
  }

  const limit = 15;
  const allow = cnt <= limit;
  return NextResponse.json({ allow, tier: "free", count: cnt, limit }, { status: 200, headers: hdr });
}
