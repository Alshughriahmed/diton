export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;






import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { setPx } from "@/lib/rtc/upstash";

export async function POST(req: NextRequest) {
  const anon = extractAnonId(req);
  if (!anon) return NextResponse.json({ error:"anon-required" }, { status:401 });
  try{
    const body = await req.json().catch(()=>null) as any;
    const peer = String(body?.peer || "");
    if(!peer) return NextResponse.json({ ok:false }, { status:400 });
    // TTL 8-9s مع jitter ±250ms حول 8500ms
    const base = 8500, jitter = Math.floor(Math.random()*500) - 250;
    await setPx(`rtc:prev-for:${anon}`, peer, base + jitter);
    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:String(e?.message||e).slice(0,140) }, { status:500 });
  }
}
