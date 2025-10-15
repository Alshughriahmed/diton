// src/app/api/match/next/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tryMatch, getRoom, haveRedisEnv } from "@/lib/match/redis";

function hNoStore(req: NextRequest, extra?: Record<string, string>) {
  const h: Record<string, string> = {
    "cache-control": "no-store, max-age=0",
    "x-req-id-echo": req.headers.get("x-req-id") || "",
  };
  if (extra) Object.assign(h, extra);
  return h;
}

// normalize any shape returned from redis helpers into a plain room string
function normRoom(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as any;
    if (typeof o.room === "string") return o.room;
    if (typeof o.result === "string") return o.result;
    if (o.result == null) return null;
  }
  return null;
}

export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new NextResponse(null, { status: 204, headers: hNoStore(req) });
}

export async function GET(req: NextRequest) {
  await cookies();

  if (!haveRedisEnv()) {
    return NextResponse.json(
      {
        error: "redis env missing",
        hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      },
      { status: 500, headers: hNoStore(req) },
    );
  }

  const sp = new URL(req.url).searchParams;
  const ticket = sp.get("ticket") || "";
  const waitMs = Math.min(15_000, Math.max(0, Number(sp.get("wait") || "0")));

  if (!ticket) {
    return NextResponse.json(
      { error: "ticket required" },
      { status: 400, headers: hNoStore(req) },
    );
  }

  // fast-path: ticket already mapped
  const existingRaw = await getRoom(ticket);
  const existing = normRoom(existingRaw);
  if (existing) {
    return NextResponse.json({ room: existing }, { headers: hNoStore(req) });
  }

  const start = Date.now();
  while (true) {
    const elapsed = Date.now() - start;
    const widen = elapsed >= 3000;

    const r = await tryMatch(ticket, widen);
    const room = normRoom((r as any)?.room ?? r);
    if (room) {
      return NextResponse.json({ room }, { headers: hNoStore(req) });
    }

    if (elapsed >= waitMs) {
      return new NextResponse(null, { status: 204, headers: hNoStore(req) });
    }
    await new Promise((res) => setTimeout(res, 200));
  }
}
