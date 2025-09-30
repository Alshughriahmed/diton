import { NextResponse } from "next/server";
export const runtime = "nodejs";

// Reorder ICE servers to prioritize TURNS:443 and TURN:443
function reorderIceServers(servers: any[]): any[] {
  if (!Array.isArray(servers) || servers.length === 0) return servers;
  
  const turns443: any[] = [];
  const turn443: any[] = [];
  const turn3478: any[] = [];
  const stun: any[] = [];
  const other: any[] = [];
  
  for (const server of servers) {
    const urls = Array.isArray((server as any).urls) ? (server as any).urls : [(server as any).urls || (server as any).url];
    
    // Check if any URL in this server is TURNS:443 or TURN:443 (both prioritized for port 443 firewall traversal)
    const hasTurns443Url = urls?.some((u: string) => /^turns?:.*:443(\?|$)/i.test(String(u)));
    if (hasTurns443Url) {
      turns443.push(server);
      continue;
    }
    
    // Check if any URL in this server is TURN:3478
    const hasTurn3478Url = urls?.some((u: string) => /^turn:.*:3478(\?|$)/i.test(String(u)));
    if (hasTurn3478Url) {
      turn3478.push(server);
      continue;
    }
    
    // Check if any URL in this server is STUN
    const hasStunUrl = urls?.some((u: string) => /^stuns?:/i.test(String(u)));
    if (hasStunUrl) {
      stun.push(server);
      continue;
    }
    
    // Everything else
    other.push(server);
  }
  
  // Return in priority order: TURNS:443/TURN:443, TURN:3478, STUN, others
  return [...turns443, ...turn443, ...turn3478, ...stun, ...other];
}

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
  const rawIceServers = fb ?? [{ urls: "stun:stun.l.google.com:19302" }];
  
  // Apply reordering to prioritize TURNS:443 and TURN:443 servers first
  const iceServers = reorderIceServers(rawIceServers);
  
  return NextResponse.json({ iceServers });
}
export const dynamic="force-dynamic";
