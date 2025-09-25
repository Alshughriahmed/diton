export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;







import { NextResponse } from "next/server";
import { zcard, zremrangebyscore, MODE } from "@/lib/rtc/upstash";
export async function GET() {
  try {
    const cutoff = Date.now() - 60_000;
    await zremrangebyscore(`rtc:q`, "-inf", `(${cutoff}`);
    const len = await zcard(`rtc:q`);
    return NextResponse.json({ mode: MODE, len: Number(len || 0) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ mode: MODE === "redis" ? "redis-fail" : "memory", len: 0, error: String(e?.message||e).slice(0,120) }, { status: 200 });
  }
}
