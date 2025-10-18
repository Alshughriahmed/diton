// src/app/api/match/enqueue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { enqueue, haveRedisEnv } from "@/lib/match/redis";

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

function bad(msg: string, code = 400) {
  return new NextResponse(JSON.stringify({ error: msg }), { status: code, headers: noStore() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
}

export async function POST(req: NextRequest) {
  if (!haveRedisEnv()) {
    return bad("redis env missing", 503);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return bad("invalid json body");
  }

  // تطبيع إدخال العميل
  const identity = String(body?.identity || "");
  const deviceId = String(body?.deviceId || "");
  if (!identity || !deviceId) return bad("identity and deviceId required");

  const selfGender = body?.selfGender;
  const selfCountry = body?.selfCountry ?? null;
  const filterGenders = Array.isArray(body?.filterGenders) ? body.filterGenders : [];
  const filterCountries = Array.isArray(body?.filterCountries) ? body.filterCountries : [];
  const vip = !!body?.vip;
  const ts = Number.isFinite(body?.ts) ? Number(body.ts) : undefined;
  const ticketHint = typeof body?.ticket === "string" ? body.ticket : undefined;

  try {
    const { ticket, ts: ets } = await enqueue({
      identity,
      deviceId,
      selfGender,
      selfCountry,
      filterGenders,
      filterCountries,
      vip,
      ts,
      ticketHint,
    });

    return new NextResponse(JSON.stringify({ ticket, ts: ets }), {
      status: 200,
      headers: noStore(),
    });
  } catch (e: any) {
    // أعد رسالة واضحة للتشخيص بدل 500 عام
    const msg = typeof e?.message === "string" ? e.message : String(e);
    return new NextResponse(JSON.stringify({ error: "enqueue failed", message: msg }), {
      status: 500,
      headers: noStore(),
    });
  }
}

// GET alias اختياري للتشخيص الآمن
export async function GET(req: NextRequest) {
  if (!haveRedisEnv()) return bad("redis env missing", 503);
  const u = new URL(req.url);
  const identity = u.searchParams.get("identity") || "";
  const deviceId = u.searchParams.get("deviceId") || "";
  if (!identity || !deviceId) return bad("identity and deviceId required");
  try {
    const { ticket, ts } = await enqueue({
      identity,
      deviceId,
      selfGender: u.searchParams.get("selfGender") || undefined,
      selfCountry: u.searchParams.get("selfCountry") || undefined,
      filterGenders: (u.searchParams.getAll("g") || []).filter(Boolean),
      filterCountries: (u.searchParams.getAll("c") || []).filter(Boolean),
      vip: u.searchParams.get("vip") === "1",
    });
    return new NextResponse(JSON.stringify({ ticket, ts }), { status: 200, headers: noStore() });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : String(e);
    return new NextResponse(JSON.stringify({ error: "enqueue failed", message: msg }), {
      status: 500,
      headers: noStore(),
    });
  }
}
