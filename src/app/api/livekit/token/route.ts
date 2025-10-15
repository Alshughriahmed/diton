// src/app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

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
  const { searchParams } = new URL(req.url);
  const room = searchParams.get("room") || "";
  const identity = searchParams.get("identity") || "";

  if (!room || !identity) {
    return new NextResponse(JSON.stringify({ error: "room and identity are required" }), {
      status: 400,
      headers: noStore(),
    });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return new NextResponse(JSON.stringify({ error: "livekit env missing" }), {
      status: 503,
      headers: noStore(),
    });
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: identity,
      ttl: "5m",
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return new NextResponse(JSON.stringify({ token }), { status: 200, headers: noStore() });
  } catch (e: any) {
    const msg = String(e?.message || e || "token generation failed");
    return new NextResponse(JSON.stringify({ error: msg }), { status: 500, headers: noStore() });
  }
}
