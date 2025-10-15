// src/app/api/match/next/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRoom, tryMatch } from "@/lib/match/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

function noStore(h: Headers) {
  h.set("cache-control", "no-store");
  return h;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticket = searchParams.get("ticket") || "";
  const wait = Math.min(10_000, Math.max(0, Number(searchParams.get("wait") || "0")));
  if (!ticket) {
    return new NextResponse(JSON.stringify({ error: "ticket required" }), {
      status: 400,
      headers: noStore(new Headers({ "content-type": "application/json" })),
    });
  }

  const t0 = Date.now();
  while (true) {
    // 1) already assigned?
    const r = await getRoom(ticket);
    if (r) {
      return new NextResponse(JSON.stringify({ room: r }), {
        status: 200,
        headers: noStore(new Headers({ "content-type": "application/json" })),
      });
    }

    // 2) try to match
    const elapsed = Date.now() - t0;
    const widen = elapsed > 3000; // توسيع المعايير بعد 3s
    const room = await tryMatch(ticket, widen);
    if (room) {
      return new NextResponse(JSON.stringify({ room }), {
        status: 200,
        headers: noStore(new Headers({ "content-type": "application/json" })),
      });
    }

    if (elapsed >= wait) {
      return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
    }
    await sleep(400);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: noStore(new Headers()),
  });
}
