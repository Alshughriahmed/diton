import { NextResponse } from "next/server";
import { qLen } from "@/lib/queue";
export const runtime = "nodejs";
export const revalidate = 0;
export async function GET() {
  const q: any = await qLen();
  const len = typeof q?.len === "number" ? q.len : (q?.len?.len ?? 0);
  const mode = q?.mode ?? "memory";
  return NextResponse.json({ mode, len });
}