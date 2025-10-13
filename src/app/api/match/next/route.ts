// src/app/api/match/next/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"];

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tryMatch, getRoom } from "@/lib/match/redis";

function hNoStore(req: NextRequest, extra?: Record<string,string>) {
  const h: Record<string,string> = {
    "cache-control": "no-store, max-age=0",
    "x-req-id-echo": req.headers.get("x-req-id") || "",
  };
  if (extra) Object.assign(h, extra);
  return h;
}

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new NextResponse(null, { status: 204, headers: hNoStore(req) });
}

export async function GET(req: NextRequest) {
  await cookies();
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new NextResponse(JSON.stringify({ error: "redis env missing" }), { status: 500, headers: hNoStore(req, { "content-type":"application/json" }) });
  }
  const sp = new URL(req.url).searchParams;
  const ticket = sp.get("ticket") || "";
  const wait = Math.min(15000, Math.max(0, Number(sp.get("wait") || "0")));
  if (!ticket) {
    return new NextResponse(JSON.stringify({ error: "ticket required" }), { status: 400, headers: hNoStore(req, { "content-type":"application/json" }) });
  }

  // fast path: existing room mapping
  const existing = await getRoom(ticket);
  if (existing) {
    return new NextResponse(JSON.stringify({ room: existing }), { status: 200, headers: hNoStore(req, { "content-type":"application/json" }) });
  }

  const start = Date.now();
  while (true) {
    const elapsed = Date.now() - start;
    const widen = elapsed >= 3000; // widen criteria after 3s
    const r = await tryMatch(ticket, widen);
    if (r?.room) {
      return new NextResponse(JSON.stringify({ room: r.room }), { status: 200, headers: hNoStore(req, { "content-type":"application/json" }) });
    }
    if (elapsed >= wait) {
      return new NextResponse(null, { status: 204, headers: hNoStore(req) });
    }
    await new Promise(res => setTimeout(res, 200));
  }
}
