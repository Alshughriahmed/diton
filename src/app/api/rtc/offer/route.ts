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
  const anonId = u.searchParams.get("anonId");
  if (!pairId || !role || !anonId) return NextResponse.json({ ok: false, error: "missing params" }, { status: 400 });
  
  // Verify anonId is authorized for this pairId/role
  const whoCheck = await rGet(`rtc:who:${anonId}`);
  if (!whoCheck.value) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  
  try {
    const whoData = JSON.parse(whoCheck.value);
    if (whoData.pairId !== pairId || whoData.role !== role) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid auth" }, { status: 403 });
  }
  
  const r = await rGet(key(pairId, other(role)));
  if (!r.value) return NextResponse.json({ ok: true, ready: false });
  
  return NextResponse.json({ ok: true, ready: true, ...JSON.parse(r.value) });
}
