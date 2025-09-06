import { NextResponse } from "next/server";

export async function POST() {
  const ageProvider = process.env.AGE_PROVIDER || "stub";
  
  if (ageProvider === "stub") {
    // Set age verification cookie for 1 year
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: "ageok",
      value: "1",
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });
    return response;
  }
  
  // For real providers, would verify webhook signature and extract result
  // TODO: Implement when real provider keys are available
  return NextResponse.json({
    ok: false,
    error: "Provider not configured"
  }, { status: 501 });
}