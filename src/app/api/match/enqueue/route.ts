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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: noStore(new Headers()) });
}

export async function POST(req: NextRequest) {
  try {
    if (!haveRedisEnv()) {
      return new NextResponse(JSON.stringify({ error: "redis env missing" }), {
        status: 503,
        headers: noStore(),
      });
    }

    const body = await req.json().catch(() => ({} as any));
    const {
      identity,
      deviceId,
      selfGender = null,
      selfCountry = null,
      filterGenders = null,
      filterCountries = null,
      vip = null,
      ticket: ticketHint, // ← optional reuse
    } = body || {};

    if (!identity || !deviceId) {
      return new NextResponse(JSON.stringify({ error: "identity and deviceId are required" }), {
        status: 400,
        headers: noStore(),
      });
    }

    const { ticket } = await enqueue({
      identity: String(identity),
      deviceId: String(deviceId),
      selfGender: selfGender != null ? String(selfGender) : undefined,
      selfCountry: selfCountry ? String(selfCountry) : null,
      filterGenders: Array.isArray(filterGenders) ? filterGenders.map(String) : undefined,
      filterCountries: Array.isArray(filterCountries) ? filterCountries.map(String) : undefined,
      vip: !!vip,
      ticketHint: typeof ticketHint === "string" ? ticketHint : undefined,
    });

    return new NextResponse(JSON.stringify({ ok: true, ticket }), {
      status: 200,
      headers: noStore(),
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "enqueue failed");
    return new NextResponse(JSON.stringify({ error: msg }), {
      status: 500,
      headers: noStore(),
    });
  }
}
