import { NextResponse } from "next/server";
import { rSet, rGet } from "@/lib/redis";
import { qPop2 } from "@/lib/queue";

export const runtime = "nodejs";
const TTL = 60 * 60; // 1h

function pid() { return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}` }
function whoKey(anon: string) { return `rtc:who:${anon}` }
function pairKey(p: string) { return `rtc:pair:${p}` }

// GET /api/rtc/matchmake?anonId=...
export async function GET(req: Request) {
  const u = new URL(req.url);
  const anon = u.searchParams.get("anonId") || "";
  if (!anon) return NextResponse.json({ ok: false, error: "anonId" }, { status: 400 });
  
  const who = await rGet(whoKey(anon));
  if (who.value) {
    try {
      const obj = JSON.parse(who.value);
      return NextResponse.json({ ok: true, found: true, pairId: obj.pairId, role: obj.role });
    } catch {}
  }
  return NextResponse.json({ ok: true, found: false });
}

// POST /api/rtc/matchmake -> try pair two
export async function POST() {
  const pair = await qPop2();
  if (!pair.pair) {
    return NextResponse.json({ ok: true, paired: false });
  }
  
  const [a, b] = pair.pair as [string, string];
  const p = pid();
  
  await rSet(pairKey(p), JSON.stringify({ a, b, ts: Date.now() }), TTL);
  await rSet(whoKey(a), JSON.stringify({ pairId: p, role: "caller" }), TTL);
  await rSet(whoKey(b), JSON.stringify({ pairId: p, role: "callee" }), TTL);
  
  return NextResponse.json({ ok: true, paired: true, pairId: p, a, b });
}