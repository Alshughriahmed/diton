import { NextResponse } from "next/server";
import { qLen } from "@/lib/queue";
import { zremrangebyscore } from "@/lib/rtc/upstash";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  // Broader cleanup would happen here in production Redis setup
  // For memory fallback mode, cleanup is handled automatically by queue logic
  
  const q: any = await qLen();
  const len = typeof q?.len === "number" ? q.len : (q?.len?.len ?? 0);
  const mode = q?.mode ?? "memory";
  return NextResponse.json({ mode, len });
}