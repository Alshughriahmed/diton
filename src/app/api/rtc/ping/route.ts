import { NextResponse } from "next/server";
import { rSet, rGet } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const haveEnv = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!haveEnv) {
    return NextResponse.json({ ok: false, env: false, note: "Set UPSTASH_REDIS_REST_URL/TOKEN on Vercel" }, { status: 200 });
  }
  
  const k = "rtc:ping";
  const v = String(Date.now());
  try {
    await rSet(k, v, 10);
    const back = await rGet(k);
    
    // TTL renewal would go here in production with proper Redis setup
    
    return NextResponse.json({ ok: back.value === v, env: true });
  } catch (e:any) {
    return NextResponse.json({ ok: false, env: true, error: String(e?.message||e) }, { status: 200 });
  }
}
