import { NextRequest, NextResponse } from "next/server";
import { getAnonIdUnsafe } from "@/lib/rtc/auth";
import { hgetall, expire } from "@/lib/rtc/upstash";
import { touchQueue } from "@/lib/rtc/mm";
export const runtime = "nodejs";
export async function GET(_req: NextRequest){
  const anon = getAnonIdUnsafe(); if (!anon) return NextResponse.json({ ok:false },{status:403});
  const attr = await hgetall(`rtc:attrs:${anon}`);
  if (attr?.gender && attr?.country) {
    await touchQueue(anon, { gender: attr.gender, country: attr.country });
    await Promise.all([ expire(`rtc:attrs:${anon}`,120), expire(`rtc:filters:${anon}`,120) ]);
  }
  return NextResponse.json({ ok:true },{status:200});
}
