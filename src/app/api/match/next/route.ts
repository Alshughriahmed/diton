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

async function handle(ticket: string, waitMs: number) {
  if (!ticket) {
    return new NextResponse(JSON.stringify({ error: "ticket required" }), {
      status: 400,
      headers: noStore(),
    });
  }

  const t0 = Date.now();

  // 0) probe سريع جدًا: 6 محاولات متقاربة
  for (let i = 0; i < 6; i++) {
    const assigned = await getRoom(ticket);
    if (assigned) {
      return new NextResponse(JSON.stringify({ room: assigned }), {
        status: 200,
        headers: noStore(),
      });
    }
    const mr = await tryMatch(ticket, Date.now());
    if (mr?.room) {
      return new NextResponse(JSON.stringify({ room: mr.room }), {
        status: 200,
        headers: noStore(),
      });
    }
    await sleep(120);
  }

  // 1) long-poll قصير مع backoff صغير
  let delay = 250; // يبدأ سريعًا ثم يكبر قليلًا
  while (true) {
    // غرفة معيّنة مسبقًا؟
    const assigned = await getRoom(ticket);
    if (assigned) {
      return new NextResponse(JSON.stringify({ room: assigned }), {
        status: 200,
        headers: noStore(),
      });
    }

    // محاولة مطابقة
    const mr = await tryMatch(ticket, Date.now());
    if (mr?.room) {
      return new NextResponse(JSON.stringify({ room: mr.room }), {
        status: 200,
        headers: noStore(),
      });
    }

    if (Date.now() - t0 >= waitMs) {
      return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
    }

    await sleep(delay);
    delay = Math.min(600, Math.round(delay * 1.3));
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
  const rawWait = Number(searchParams.get("wait") || "0");
  const wait = Math.min(8000, Math.max(0, isFinite(rawWait) ? rawWait : 0));
  return handle(ticket, wait);
}

// POST alias
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
  const wait = Math.min(8000, Math.max(0, isFinite(rawWait) ? rawWait : 0));

  return handle(ticket, wait);
}
