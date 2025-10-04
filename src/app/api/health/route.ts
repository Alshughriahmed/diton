import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const res = NextResponse.json({ ok: true, ts: Date.now() });
  return withReqId(res);
}
