import { NextResponse } from "next/server";
import { rSet, rGet } from "@/lib/redis";

export const runtime = "nodejs";

function key(pairId: string, role: string) { return `rtc:sdp:${pairId}:${role}`; }
function other(role: string) { return role === "caller" ? "callee" : "caller"; }

export async function OPTIONS() { return NextResponse.json({ ok: true }); }

export async function POST(req: Request) {
  const b: any = await req.json().catch(() => ({}));
  const { pairId, role, sdp } = b || {};
  if (!pairId || !role || !sdp) return NextResponse.json({ ok: false, error: "bad" }, { status: 400 });
  
  await rSet(key(pairId, role), JSON.stringify({ sdp, ts: Date.now() }), 3600);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const pairId = u.searchParams.get("pairId");
  const role = u.searchParams.get("role");
  if (!pairId || !role) return NextResponse.json({ ok: false, error: "bad" }, { status: 400 });
  
  const r = await rGet(key(pairId, other(role)));
  if (!r.value) return NextResponse.json({ ok: true, ready: false });
  
  return NextResponse.json({ ok: true, ready: true, ...JSON.parse(r.value) });
}
