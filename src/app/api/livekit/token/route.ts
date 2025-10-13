import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LK_URL = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const room = searchParams.get("room") || "ditona-public";
    const identity = searchParams.get("identity"); // يجب أن تأتي من العميل

    if (!LK_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json({ error: "LiveKit env missing" }, { status: 500 });
    }
    if (!identity) {
      return NextResponse.json({ error: "identity required" }, { status: 400 });
    }

    const at = new AccessToken(API_KEY, API_SECRET, { identity });
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return NextResponse.json({ token });
  } catch (e) {
    return NextResponse.json({ error: "token-gen-failed" }, { status: 500 });
  }
}
