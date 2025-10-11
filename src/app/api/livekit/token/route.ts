import { NextRequest } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { roomName, identity } = await req.json().catch(() => ({}));

  const wsUrl = process.env.LIVEKIT_WS_URL!;
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  if (!wsUrl || !apiKey || !apiSecret) {
    return new Response(JSON.stringify({ error: "missing-env" }), { status: 500 });
  }

  // اسم الغرفة والهوية (بسيط للتجربة)
  const room = String(roomName || "lobby");
  const id = String(identity || `u_${Math.random().toString(36).slice(2, 10)}`);

  const at = new AccessToken(apiKey, apiSecret, { identity: id });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  const token = await at.toJwt();
  return new Response(JSON.stringify({ token, wsUrl }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
