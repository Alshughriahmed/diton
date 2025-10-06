import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const res = NextResponse.json({
    status: "healthy",
    timestamp: Date.now(),
    service: "Diton",
  });
  res.headers.set("Cache-Control", "no-store");
  return withReqId(res);
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Cache-Control", "no-store");
  return withReqId(res);
}
