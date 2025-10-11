import { NextRequest } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const room = url.searchParams.get("room") || "lobby";
  const identity =
    url.searchParams.get("id") || Math.random().toString(36).slice(2);

  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  if (!apiKey || !apiSecret) {
    return new Response(JSON.stringify({ error: "LIVEKIT env missing" }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const at = new AccessToken({ issuer: apiKey, secret: apiSecret }, { identity });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  const token = await at.toJwt();
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
