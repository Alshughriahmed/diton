import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  // TODO: store SDP offer in Redis keyed by roomId
  return NextResponse.json({ ok: true, role: "caller", todo: "signal-offer" });
}
