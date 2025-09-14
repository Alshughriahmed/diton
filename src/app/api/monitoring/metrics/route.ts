import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

const URL = process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function store(m: any) {
  if (!URL || !TOKEN) return { stored: false };
  const key = `mx:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const value = JSON.stringify(m);
  
  try {
    // Use Upstash Redis REST API direct format with SETEX for 7-day TTL
    const res = await fetch(`${URL}/setex/${encodeURIComponent(key)}/604800/${encodeURIComponent(value)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}` },
      cache: 'no-store',
    });
    
    // Check HTTP status first
    if (!res.ok) return { stored: false };
    
    // Parse and validate Redis response
    const data = await res.json();
    
    // For SETEX command, Upstash returns {"result": "OK"} on success
    const stored = data && data.result === "OK";
    
    return { stored };
  } catch (err) {
    // Log error for debugging but don't expose it
    console.error('[metrics] Redis store error:', err instanceof Error ? err.message : String(err));
    return { stored: false };
  }
}

export async function POST(req: Request) {
  try {
    const m = await req.json().catch(() => ({} as any));
    const allowed = {
      ts: m.ts|0,
      sessionId: String(m.sessionId||''),
      pairId: m.pairId ? String(m.pairId).slice(0,64) : undefined,
      role: (m.role==='caller'||m.role==='callee') ? m.role : undefined,
      matchMs: m.matchMs|0,
      ttfmMs: m.ttfmMs|0,
      reconnectMs: m.reconnectMs|0,
      iceOk: !!m.iceOk,
      iceTries: m.iceTries|0,
      turns443: !!m.turns443,
    };
    const res = await store(allowed);
    return NextResponse.json({ ok: true, ...res }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

// Debug endpoint (safe): presence only, no values
export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      upstash_url: !!process.env.UPSTASH_REDIS_REST_URL,
      upstash_token: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    }
  }, { status: 200 });
}