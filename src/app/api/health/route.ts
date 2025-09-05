import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, via: "/api/health" }, { status: 200 });
}
