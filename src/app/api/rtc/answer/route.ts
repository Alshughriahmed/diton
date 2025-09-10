import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  // TODO: store SDP answer in Redis keyed by roomId
  return NextResponse.json({ ok: true, role: "callee", todo: "signal-answer" });
}
