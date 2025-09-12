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
  return Array.isArray(j?.ice_servers) ? j.ice_servers.map((s:any)=>({
    urls: s.urls, username: s.username, credential: s.credential
  })) : null;
}
export async function GET() {
  const iceServers = (await fetchTwilioIce()) ?? [{ urls: "stun:stun.l.google.com:19302" }];
  return NextResponse.json({ iceServers });
}
