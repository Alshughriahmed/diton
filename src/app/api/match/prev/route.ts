import { NextRequest, NextResponse } from "next/server";
import { haveRedisEnv, getPrevRoomForTicket } from "@/lib/match/redis";

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
    return new NextResponse(JSON.stringify({ error: "redis env missing" }), { status: 503, headers: noStore() });
  }

  try {
    const { searchParams } = new URL(req.url);
    const ticket = searchParams.get("ticket") || "";
    if (!ticket) {
      return new NextResponse(JSON.stringify({ error: "ticket required" }), { status: 400, headers: noStore() });
    }

    const room = await getPrevRoomForTicket(ticket).catch(() => null);
    if (!room) {
      return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
    }

    return new NextResponse(JSON.stringify({ room }), { status: 200, headers: noStore() });
  } catch {
    // فشل غير مهم: لا نكسر التدفق
    return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
  }
}

// POST = GET
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const tFromQs = url.searchParams.get("ticket");
  let body: any = null;
  try { body = await req.json(); } catch {}
  const ticket = String(tFromQs ?? body?.ticket ?? "");
  const fakeReq = new NextRequest(new URL(`${url.origin}${url.pathname}?ticket=${encodeURIComponent(ticket)}`).toString(), req);
  return GET(fakeReq);
}
