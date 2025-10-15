// src/app/api/match/enqueue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/match/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

function noStore(h: Headers) {
  h.set("cache-control", "no-store");
  return h;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      identity,
      deviceId,
      selfGender = null,
      selfCountry = null,
      filterGenders = null,
      filterCountries = null,
      vip = null,
    } = body || {};

    if (!identity || !deviceId) {
      return new NextResponse(
        JSON.stringify({ error: "identity and deviceId are required" }),
        { status: 400, headers: noStore(new Headers({ "content-type": "application/json" })) }
      );
    }

    const { ticket } = await enqueue({
      identity,
      deviceId,
      selfGender,
      selfCountry,
      filterGenders,
      filterCountries,
      vip,
    });

    return new NextResponse(JSON.stringify({ ok: true, ticket }), {
      status: 200,
      headers: noStore(new Headers({ "content-type": "application/json" })),
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "enqueue failed");
    return new NextResponse(JSON.stringify({ error: msg }), {
      status: 500,
      headers: noStore(new Headers({ "content-type": "application/json" })),
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: noStore(new Headers()),
  });
}
