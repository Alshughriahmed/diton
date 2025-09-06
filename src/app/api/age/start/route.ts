import { NextResponse } from "next/server";

export async function POST() {
  const ageProvider = process.env.AGE_PROVIDER || "stub";
  
  if (ageProvider === "stub") {
    const sessionId = `stub-${Date.now()}`;
    return NextResponse.json({
      ok: true,
      session_id: sessionId
    });
  }
  
  // For real providers (veriff, yoti), would redirect to external verification
  // TODO: Implement when real provider keys are available
  return NextResponse.json({
    ok: false,
    error: "Provider not configured"
  }, { status: 501 });
}