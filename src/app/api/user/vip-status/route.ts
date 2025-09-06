import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const vipCookie = req.cookies.get("vip")?.value === "1";
  if (vipCookie) {
    return NextResponse.json({ isVip: true, via: "cookie" });
  }
  // نقطة تمديد مستقبلية لقراءة الجلسة/DB:
  // if (await hasDbVip(req)) return NextResponse.json({ isVip: true, via: "db" });
  return NextResponse.json({ isVip: false, via: "anon" });
}
