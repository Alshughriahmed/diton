import { NextResponse } from "next/server";
import { rLPush, rLPop, rGet } from "@/lib/redis";
export const runtime = "nodejs";

function key(pid:string, role:string) { return `rtc:ice:${pid}:${role}`; }
function otherRole(role:string) { return role === "caller" ? "callee" : "caller"; }

export async function OPTIONS() { return NextResponse.json({ ok:true }); }

export async function POST(req: Request) {
  try {
    const b:any = await req.json();
    const { pairId, candidate, anonId } = b || {};
    if (!pairId || !candidate || !anonId) return NextResponse.json({ ok:false, error:"missing params" }, { status: 400 });
    
    // Verify anonId is authorized for this pairId and get role
    const whoCheck = await rGet(`rtc:who:${anonId}`);
    if (!whoCheck.value) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
    
    let myRole;
    try {
      const whoData = JSON.parse(whoCheck.value);
      if (whoData.pairId !== pairId) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
      }
      myRole = whoData.role;
    } catch {
      return NextResponse.json({ ok: false, error: "invalid auth" }, { status: 403 });
    }
    
    try {
      // Store candidate in my role queue so the other peer can read it
      await rLPush(key(pairId, myRole), JSON.stringify(candidate));
      return NextResponse.json({ ok:true });
    } catch {
      // Redis unavailable, return error so client can retry
      return NextResponse.json({ ok:false, error:"redis unavailable" }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ ok:false }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const pairId = u.searchParams.get("pairId");
  const anonId = u.searchParams.get("anonId");
  if (!pairId || !anonId) return NextResponse.json({ ok:false, error:"missing params" }, { status: 400 });
  
  // Verify anonId is authorized for this pairId and get role
  const whoCheck = await rGet(`rtc:who:${anonId}`);
  if (!whoCheck.value) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  
  let myRole;
  try {
    const whoData = JSON.parse(whoCheck.value);
    if (whoData.pairId !== pairId) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
    }
    myRole = whoData.role;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid auth" }, { status: 403 });
  }
  
  try {
    // Read from the other peer's queue to get their candidates
    const r = await rLPop(key(pairId, otherRole(myRole)));
    const cand = r.value ? JSON.parse(r.value) : null;
    return NextResponse.json({ ok:true, candidate: cand });
  } catch {
    // Redis unavailable, return error so client knows to retry
    return NextResponse.json({ ok:false, error:"redis unavailable" }, { status: 503 });
  }
}
