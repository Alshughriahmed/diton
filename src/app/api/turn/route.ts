import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey } from "@/utils/ratelimit";

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitKey = getRateLimitKey(req, 'turn');
  if (!checkRateLimit(rateLimitKey, 30, 30)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  // TURN/STUN fallback: use env vars if available, else default to Google STUN
  const iceServers = [];
  
  // Add TURN server if credentials are available
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD,
    });
  }
  
  // Always include Google STUN as fallback
  iceServers.push({ urls: 'stun:stun.l.google.com:19302' });

  return NextResponse.json({ iceServers });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";