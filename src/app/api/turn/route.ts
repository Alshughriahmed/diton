import { NextResponse } from "next/server";

/**
 * Returns ICE servers with Twilio TURN over UDP, TCP, and TLS:443.
 * Username/Credential pulled from common env names without logging secrets.
 */
function cred() {
  const username =
    process.env.TWILIO_TURN_USERNAME ||
    process.env.TURN_USERNAME ||
    process.env.TW_TURN_USERNAME ||
    "";
  const credential =
    process.env.TWILIO_TURN_CREDENTIAL ||
    process.env.TURN_CREDENTIAL ||
    process.env.TW_TURN_CREDENTIAL ||
    "";
  return { username, credential };
}

export async function GET() {
  const { username, credential } = cred();
  const iceServers: any[] = [
    {
      urls: [
        "turn:global.turn.twilio.com:3478?transport=udp",
        "turn:global.turn.twilio.com:3478?transport=tcp",
        "turns:global.turn.twilio.com:443?transport=tcp",
      ],
      username,
      credential,
    },
    { urls: "stun:stun.l.google.com:19302" },
  ];
  return NextResponse.json({ iceServers });
}
