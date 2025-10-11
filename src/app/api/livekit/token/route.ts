// /src/app/api/livekit/token/route.ts
import { NextRequest } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const room = url.searchParams.get("room") || "lobby";

  const apiKey = process.env.LIVEKIT_API_KEY || "";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "";
  if (!apiKey || !apiSecret) {
    return new Response(JSON.stringify({ error: "missing-keys" }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const identity = crypto.randomUUID();

  // v2: مرّر المنح ككائن مباشرة، لا تستخدم VideoGrant كقيمة
  const at = new AccessToken(apiKey, apiSecret, { identity });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();

  return new Response(JSON.stringify({ token, room, identity }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
