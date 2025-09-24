export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;







import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { get, lpush, lrange, ltrim, expire } from "@/lib/rtc/upstash";

async function auth(anon: string, pairId: string) {
  const map = await get(`rtc:pair:map:${anon}`); if (!map) return null;
  const [pid, role] = String(map).split("|"); if (pid !== pairId) return null;
  return role as "caller" | "callee";
}

export async function POST(req: NextRequest) {
  try {
    const anon = extractAnonId(req); if (!anon) return NextResponse.json({ error: "anon-required" }, { status: 403 });
    const { pairId, candidate } = await req.json().catch(() => ({}));
    if (!pairId || !candidate) return NextResponse.json({ error: "bad-input" }, { status: 400 });

    const role = await auth(anon, pairId); if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const dest = role === "caller" ? "b" : "a";
    const key = `rtc:pair:${pairId}:ice:${dest}`;
    await lpush(key, JSON.stringify({ from: role === "caller" ? "a" : "b", cand: candidate }));
    await expire(key, 150); await expire(`rtc:pair:${pairId}`, 150);
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json({ error: "ice-post-fail", info: String(e?.message || e).slice(0, 140) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const anon = extractAnonId(req); if (!anon) return NextResponse.json({ error: "anon-required" }, { status: 403 });
  const pairId = String(new URL(req.url).searchParams.get("pairId") || "");
  if (!pairId) return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const role = await auth(anon, pairId); if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = role === "caller" ? "a" : "b";
  const key = `rtc:pair:${pairId}:ice:${me}`;
  const items = await lrange(key, 0, 49);
  if (!items || items.length === 0) return new NextResponse(null, { status: 204 });
  await ltrim(key, items.length, -1); await expire(`rtc:pair:${pairId}`, 150);
  return NextResponse.json(items.map(s => JSON.parse(s)), { status: 200 });
}
