/* Prev buffer API
 * Key:   rtc:prev:{anonId}
 * Value: JSON { pairId, peerAnonId, meta, ts }
 * TTL:   from env PREV_TTL_SEC (seconds). No hard-coded values.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractAnonId } from "@/lib/rtc/auth";

// Runtime hints
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// Vercel regions
export const preferredRegion = ['fra1','iad1']

// ---------- helpers: headers ----------
function withStdHeaders(req: NextRequest, res: NextResponse) {
  try {
    const reqId = req.headers.get("x-req-id");
    if (reqId) res.headers.set("x-req-id", reqId);
    res.headers.set("Cache-Control", "no-store");
  } catch {}
  return res;
}

// ---------- Upstash helpers (local, no new imports) ----------
const UP_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
async function upstashPipeline(commands: string[][]) {
  if (!UP_URL || !UP_TOKEN) throw new Error("upstash-env-missing");
  const r = await fetch(`${UP_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ commands }),
  });
  if (!r.ok) throw new Error(`upstash-${r.status}`);
  return (await r.json()) as Array<{ result: unknown }>;
}
async function upSetPXJSON(key: string, value: unknown, ttlMs: number) {
  const json = JSON.stringify(value);
  await upstashPipeline([["SET", key, json, "PX", String(ttlMs)]]);
}
async function upGetDel(key: string): Promise<string | null> {
  const [res] = await upstashPipeline([["GETDEL", key]]);
  const val = (res?.result ?? null) as string | null;
  return val ?? null;
}

// ---------- common ----------
function getPrevKey(anonId: string) {
  return `rtc:prev:${anonId}`;
}
function getPrevTtlMs() {
  const sec = Number(process.env.PREV_TTL_SEC || "60");
  if (!Number.isFinite(sec) || sec <= 0) throw new Error("prev-ttl-invalid");
  return Math.floor(sec * 1000);
}

// ---------- OPTIONS ----------
export async function OPTIONS(req: NextRequest) {
  // touch cookies to satisfy await cookies() policy
  await cookies();
  return withStdHeaders(
    req,
    new NextResponse(null, { status: 204 }),
  );
}

// ---------- GET: consume once ----------
export async function GET(req: NextRequest) {
  await cookies(); // policy
  const anonId = extractAnonId(req);
  if (!anonId) {
    return withStdHeaders(
      req,
      NextResponse.json({ error: "anon-required" }, { status: 401 }),
    );
  }
  try {
    const raw = await upGetDel(getPrevKey(anonId));
    if (!raw) {
      return withStdHeaders(req, new NextResponse(null, { status: 204 }));
    }
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      // corrupted payload, treat as empty
      return withStdHeaders(req, new NextResponse(null, { status: 204 }));
    }
    // self-match guard
    if (!data || typeof data !== "object" || data.peerAnonId === anonId) {
      return withStdHeaders(req, new NextResponse(null, { status: 204 }));
    }
    return withStdHeaders(
      req,
      NextResponse.json(
        {
          ok: true,
          prev: {
            pairId: String(data.pairId || ""),
            peerAnonId: String(data.peerAnonId || ""),
            meta: data.meta ?? null,
            ts: Number(data.ts || 0),
          },
        },
        { status: 200 },
      ),
    );
  } catch (e: any) {
    return withStdHeaders(
      req,
      NextResponse.json(
        { ok: false, error: String(e?.message || e).slice(0, 180) },
        { status: 500 },
      ),
    );
  }
}

// ---------- POST: set buffer ----------
export async function POST(req: NextRequest) {
  await cookies(); // policy
  const anonId = extractAnonId(req);
  if (!anonId) {
    return withStdHeaders(
      req,
      NextResponse.json({ error: "anon-required" }, { status: 401 }),
    );
  }
  try {
    const body = (await req.json().catch(() => null)) as any;
    const pairId = String(body?.pairId || "");
    const peerAnonId = String(body?.peerAnonId || "");
    const meta = body?.meta ?? null;

    if (!pairId || !peerAnonId) {
      return withStdHeaders(
        req,
        NextResponse.json({ ok: false, error: "pairId|peerAnonId-required" }, { status: 400 }),
      );
    }
    // do not store self-match
    if (peerAnonId === anonId) {
      return withStdHeaders(req, new NextResponse(null, { status: 204 }));
    }

    const payload = { pairId, peerAnonId, meta, ts: Date.now() };
    await upSetPXJSON(getPrevKey(anonId), payload, getPrevTtlMs());

    return withStdHeaders(req, NextResponse.json({ ok: true }, { status: 200 }));
  } catch (e: any) {
    return withStdHeaders(
      req,
      NextResponse.json(
        { ok: false, error: String(e?.message || e).slice(0, 180) },
        { status: 500 },
      ),
    );
  }
}
