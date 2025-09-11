import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { matchmake, pairMapOf } from "@/lib/rtc/mm";
export const runtime = "nodejs";
export async function POST(_req: NextRequest) {
  const anon = extractAnonId(_req);
  if (!anon) return NextResponse.json({ error:"anon-required" }, { status:403 });
  const mapped = await pairMapOf(anon);
  if (mapped) return NextResponse.json({ pairId:mapped.pairId, role:mapped.role }, { status:200 });
  const res = await matchmake(anon);
  if (res.status === 200) return NextResponse.json(res.body, { status:200 });
  if (res.status === 204) return new NextResponse(null, { status:204 });
  return NextResponse.json(res.body || { error:"mm-fail" }, { status: res.status || 500 });
}
