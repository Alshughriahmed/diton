import { NextResponse } from "next/server";
import { qLen, queueMode } from "@/lib/queue";
export const runtime = "nodejs";
export async function GET() {
  const n = await qLen();
  return NextResponse.json({ mode: queueMode(), len: n });
}
