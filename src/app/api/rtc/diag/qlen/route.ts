import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MODE, zcard } from "@/lib/rtc/upstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

function noStore<T extends Response>(r: T): T {
  try { (r as any).headers?.set?.("Cache-Control","no-store"); } catch {}
  return r;
}

export async function OPTIONS() {
  return noStore(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  await cookies();
  const reqId = req.headers.get("x-req-id") || crypto.randomUUID();
  try {
    const all = await zcard("rtc:q");
    const vip = await zcard("rtc:q:vip");
    const res = NextResponse.json({ ok: true, mode: MODE, qlen: { all, vip } }, { status: 200 });
    res.headers.set("Cache-Control","no-store");
    res.headers.set("x-req-id", reqId);
    return res;
  } catch (e: any) {
    const res = NextResponse.json({ ok:false, error:String(e?.message||e) }, { status: 500 });
    res.headers.set("Cache-Control","no-store");
    res.headers.set("x-req-id", reqId);
    return res;
  }
}
