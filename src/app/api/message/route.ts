import { NextResponse } from "next/server";
import { requireVip } from "@/utils/vip";
import { rateLimit } from "@/lib/rtc/upstash";

export const runtime = "nodejs";

const FREE = process.env.NEXT_PUBLIC_FREE_FOR_ALL === "1" || process.env.FREE_FOR_ALL === "1";
const MAX_NONVIP_PER_PAIR = 15;
const WINDOW_SEC = 2 * 60 * 60; // 2h window; يزول تلقائيًا مع تغيّر pairId

// fallback قديم: IP|UA لكل ساعة
const hits = new Map<string, { n:number; t:number }>();
function ipUaKey(req: Request) {
  const f = (req.headers.get("x-forwarded-for")||"").split(",")[0].trim();
  const ua = req.headers.get("user-agent")||"";
  return `${f}|${ua.slice(0,24)}`;
}
const h = (r:Request,n:string)=> r.headers.get(n)||"";

export async function POST(req: Request) {
  let body:any = {};
  try { body = await req.json(); } catch {}
  const msg = (body?.text ?? body?.message ?? body?.txt ?? "").trim();
  if (!msg) return NextResponse.json({ ok:false, error:"bad message" }, { status: 400 });

  // فتح كامل
  if (FREE) return NextResponse.json({ ok:true });

  // VIP غير محدود
  const isVip = await requireVip();
  if (isVip) return NextResponse.json({ ok:true });

  // حدّ غير VIP لكل pairId + anon
  const url = new URL(req.url);
  const pairId = String(body?.pairId || url.searchParams.get("pairId") || h(req,"x-pair") || "").trim();
  const anon   = String(h(req,"x-anon") || "").trim();

  if (pairId && anon) {
    const key = `msg:${pairId}:${anon}`;
    const ok = await rateLimit(key, MAX_NONVIP_PER_PAIR, WINDOW_SEC);
    if (!ok) return NextResponse.json({ ok:false, error:"limit" }, { status: 429 });
    return NextResponse.json({ ok:true });
  }

  // fallback: 10/ساعة على IP|UA (سلوك سابق)
  const k = ipUaKey(req);
  const now = Date.now();
  const row = hits.get(k) || { n:0, t: now };
  if (now - row.t > 60*60*1000) { row.n = 0; row.t = now; }
  row.n += 1; hits.set(k, row);
  if (row.n > 10) return NextResponse.json({ ok:false, error:"rate limit" }, { status: 429 });
  return NextResponse.json({ ok:true });
}
export const dynamic="force-dynamic";
