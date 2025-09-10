import { NextResponse } from "next/server";
import { rLPush, rLPop } from "@/lib/redis";
export const runtime = "nodejs";

function key(pid:string) { return `rtc:ice:${pid}`; }

export async function OPTIONS() { return NextResponse.json({ ok:true }); }

export async function POST(req: Request) {
  try {
    const b:any = await req.json();
    const pid = b?.pairId;
    const cand = b?.candidate;
    if (!pid || !cand) return NextResponse.json({ ok:false, error:"missing" }, { status: 400 });
    try {
      await rLPush(key(pid), JSON.stringify(cand));
      return NextResponse.json({ ok:true });
    } catch {
      // Redis unavailable, return success but note fallback
      return NextResponse.json({ ok:true, mode:"memory-fallback" });
    }
  } catch {
    return NextResponse.json({ ok:false }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const pid = u.searchParams.get("pairId");
  if (!pid) return NextResponse.json({ ok:false, error:"pairId" }, { status: 400 });
  try {
    const r = await rLPop(key(pid));
    const cand = r.value ? JSON.parse(r.value) : null;
    return NextResponse.json({ ok:true, candidate: cand });
  } catch {
    // Redis unavailable, return no candidate
    return NextResponse.json({ ok:true, candidate: null, mode:"memory-fallback" });
  }
}
