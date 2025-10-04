export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function bool(v: string|undefined){ return v === "1" || v === "true"; }

export async function GET() {
  const payload = {
    service: "DitonaChat",
    buildId: process.env.VERCEL_GIT_COMMIT_SHA || process.env.BUILD_ID || "dev",
    node: process.version,
    freeForAll: bool(process.env.FREE_FOR_ALL) || bool(process.env.NEXT_PUBLIC_FREE_FOR_ALL),
    now: new Date().toISOString()
  };
  return withReqId(NextResponse.json(payload, {
    headers: { "cache-control": "no-store, no-cache, must-revalidate" }
  }));
}
