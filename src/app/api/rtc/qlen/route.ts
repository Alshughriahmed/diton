import { NextResponse } from "next/server";
import { zcard, zremrangebyscore } from "@/lib/rtc/upstash";
export const runtime = "nodejs";
export async function GET(){
  const cutoff = Date.now() - 60_000;
  await Promise.all([ zremrangebyscore(`rtc:q`, "-inf", `(${cutoff}`) ]);
  const len = await zcard(`rtc:q`);
  return NextResponse.json({ mode:"redis", len:Number(len||0) },{status:200});
}
