import { NextResponse } from "next/server";
import { MODE, pingRedis } from "@/lib/rtc/upstash";

const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

export const runtime = "nodejs";
export async function GET() {
  const urlOk = /^https?:\/\/.+upstash\.io/i.test(url);
  const tokenPresent = token.length > 10;
  const ping = await pingRedis().catch(()=>({ok:false, err: "catch failed"}));
  // لا نكشف القيم؛ فقط مؤشرات صحة
  return NextResponse.json({
    mode: MODE,
    url_ok: urlOk,
    token_present: tokenPresent,
    ping_ok: !!ping.ok,
    ping_err: ping.ok ? undefined : (ping as any).err
  }, { status: 200 });
}