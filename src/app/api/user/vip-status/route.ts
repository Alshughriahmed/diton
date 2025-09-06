import { allow, ipFrom } from "../../../../lib/ratelimit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const ip = ipFrom(req);
  const rl = allow(`${ip}:vip-status`, 60, 60_000);
  if (!rl.ok) return new Response(JSON.stringify({ ok:false, rate_limited:true, reset: rl.reset }), { status: 429, headers: { "content-type": "application/json" }});
  const vipCookie = req.cookies.get("vip")?.value === "1";
  if (vipCookie) {
    return NextResponse.json({ isVip: true, via: "cookie" });
  }
  // نقطة تمديد مستقبلية لقراءة الجلسة/DB:
  // if (await hasDbVip(req)) return NextResponse.json({ isVip: true, via: "db" });
  return NextResponse.json({ isVip: false, via: "anon" });
}
