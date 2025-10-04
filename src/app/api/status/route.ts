export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const H = { "cache-control":"no-store, no-cache, must-revalidate", "referrer-policy":"no-referrer" } as const;
const b = (v?: string) => v==="1" || v==="true";
export async function GET() {
  return withReqId(NextResponse.json({
    service: "DitonaChat",
    build: process.env.VERCEL_GIT_COMMIT_SHA || process.env.BUILD_ID || "dev",
    ffa: b(process.env.FREE_FOR_ALL) || b(process.env.NEXT_PUBLIC_FREE_FOR_ALL),
    now: new Date().toISOString(),
  }, { headers: H }));
}
export async function OPTIONS() {
  return withReqId(NextResponse.json({ ok: true }, { headers: { ...H, "access-control-allow-methods": "GET,OPTIONS" } }));
}
