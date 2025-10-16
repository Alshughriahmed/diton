// src/app/api/match/next/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRoom, tryMatch, haveRedisEnv } from "@/lib/match/redis";

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function handle(ticket: string, wait: number) {
  if (!ticket) {
    return new NextResponse(JSON.stringify({ error: "ticket required" }), {
      status: 400,
      headers: noStore(),
    });
  }

  const t0 = Date.now();
  while (true) {
    const assigned = await getRoom(ticket);
    if (assigned) {
      return new NextResponse(JSON.stringify({ room: assigned }), {
        status: 200,
        headers: noStore(),
      });
    }

    const elapsed = Date.now() - t0;
    const widen = elapsed > 3000;
    const room = await tryMatch(ticket, widen);
    if (room) {
      return new NextResponse(JSON.stringify({ room }), {
        status: 200,
        headers: noStore(),
      });
    }

    if (elapsed >= wait) {
      return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
    }
    await sleep(400);
  }
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

  const { searchParams } = new URL(req.url);
  const ticket = searchParams.get("ticket") || "";
  const wait = Math.min(10_000, Math.max(0, Number(searchParams.get("wait") || "0")));
  return handle(ticket, wait);
}

// Accept POST as alias to GET for backward-compat
export async function POST(req: NextRequest) {
  if (!haveRedisEnv()) {
    return new NextResponse(JSON.stringify({ error: "redis env missing" }), {
      status: 503,
      headers: noStore(),
    });
  }

  const url = new URL(req.url);
  const qsTicket = url.searchParams.get("ticket");
  const qsWait = url.searchParams.get("wait");

  let body: any = null;
  try { body = await req.json(); } catch {}

  const rawTicket = (qsTicket ?? body?.ticket ?? "") as string;
  const rawWait = Number(qsWait ?? body?.wait ?? 0);

  const ticket = rawTicket ? String(rawTicket) : "";
  const wait = Math.min(10_000, Math.max(0, isFinite(rawWait) ? rawWait : 0));

  return handle(ticket, wait);
}
