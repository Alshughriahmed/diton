import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true, ts: Date.now() });
  res.cookies.set({
    name: "ageok",
    value: "1",
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // سنة
  });
  return res;
}
