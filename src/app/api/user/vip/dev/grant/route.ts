import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true, isVip: true }, { status: 200 });
  res.cookies.set("vip", "1", { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 30 });
  return res;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";