import { NextRequest, NextResponse } from "next/server";
import { getRoom, haveRedisEnv } from "@/lib/match/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

function noStore(h?: Headers) {
  const hh = h ?? new Headers();
  hh.set("cache-control", "no-store");
  hh.set("content-type", "application/json");
  return hh;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
}

export async function GET(req: NextRequest) {
  if (!haveRedisEnv()) {
    return new NextResponse(JSON.stringify({ error: "redis env missing" }), {
      status: 503,
      headers: noStore(),
    });
  }
  const ticket = new URL(req.url).searchParams.get("ticket") || "";
  if (!ticket) return new NextResponse(JSON.stringify({ error: "ticket required" }), { status: 400, headers: noStore() });

  const room = await getRoom(ticket);
  if (!room) return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
  return new NextResponse(JSON.stringify({ room }), { status: 200, headers: noStore() });
}

// POST (اختياري)
export async function POST(req: NextRequest) {
  if (!haveRedisEnv()) {
    return new NextResponse(JSON.stringify({ error: "redis env missing" }), {
      status: 503,
      headers: noStore(),
    });
  }
  let body: any = null;
  try { body = await req.json(); } catch {}
  const ticket = String(body?.ticket || "");
  if (!ticket) return new NextResponse(JSON.stringify({ error: "ticket required" }), { status: 400, headers: noStore() });
  const room = await getRoom(ticket);
  if (!room) return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
  return new NextResponse(JSON.stringify({ room }), { status: 200, headers: noStore() });
}
