import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set("ageok", "1", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60 // 1 year
  });
  return response;
}

export const dynamic = "force-dynamic";