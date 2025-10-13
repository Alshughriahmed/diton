// app/api/livekit/token/route.ts
import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const room = url.searchParams.get("room") || "ditona-dev";
  const identity = url.searchParams.get("identity") || `u_${Math.random().toString(36).slice(2, 10)}`;

  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const lkUrl = process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;

  if (!apiKey || !apiSecret || !lkUrl) {
    return NextResponse.json({ error: "LiveKit env missing" }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, { identity });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });

  const token = await at.toJwt();
  return NextResponse.json({ url: lkUrl, room, identity, token });
}
