import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export const runtime = "nodejs"; // ليس edge

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const room = url.searchParams.get("room") || "ditona-public";
  const identity = url.searchParams.get("identity") || crypto.randomUUID();
  const metadata = url.searchParams.get("metadata") || "";

  const wsUrl =
    process.env.NEXT_PUBLIC_LIVEKIT_WS_URL ||
    process.env.LIVEKIT_URL ||
    "";

  const apiKey = process.env.LIVEKIT_API_KEY || "";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "";

  if (!wsUrl || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit env vars missing" },
      { status: 500 }
    );
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    metadata,
    ttl: "1h",
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, wsUrl, room, identity });
}
