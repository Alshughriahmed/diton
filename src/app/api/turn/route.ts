import { NextResponse } from "next/server";
export const runtime = "nodejs";

async function fetchTwilioIce() {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const auth = process.env.TWILIO_AUTH_TOKEN || "";
  if (!sid || !auth) return null;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64") },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => ({}));
  const arr = Array.isArray(j?.ice_servers) ? j.ice_servers : [];
  return arr.some((s:any)=>String(s.urls).includes("turn:")) ? arr : null; // نرفض STUN-only
}

function envFallback() {
  const u = process.env.TURN_USERNAME || process.env.TWILIO_TURN_USERNAME || "";
  const c = process.env.TURN_CREDENTIAL || process.env.TWILIO_TURN_CREDENTIAL || "";
  const urls = (process.env.TURN_URLS || "turn:global.turn.twilio.com:3478?transport=udp,turn:global.turn.twilio.com:3478?transport=tcp,turns:global.turn.twilio.com:443?transport=tcp")
    .split(",").map(s=>s.trim()).filter(Boolean);
  if (!u || !c) return null;
  return [{ urls, username: u, credential: c }];
}

export async function GET() {
  const tw = await fetchTwilioIce();
  const fb = tw ?? envFallback();
  const iceServers = fb ?? [{ urls: "stun:stun.l.google.com:19302" }];
  return NextResponse.json({ iceServers });
}
