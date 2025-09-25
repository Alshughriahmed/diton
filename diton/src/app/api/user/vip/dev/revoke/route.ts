import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true, isVip: false }, { status: 200 });
  res.cookies.set("vip", "", { path: "/", maxAge: 0, sameSite: "lax", httpOnly: false });
  return res;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";