// Route: /api/rtc/prev/for
// Constraints: ENV-only, no-store, OPTIONS=204, echo x-req-id, await cookies(), preferredRegion=["fra1","iad1"]

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"] as string[]; // بلا as const

import { cookies } from "next/headers";

type PrevRecord = {
  peerAnonId: string;
  pairId: string;
  ts: number; // epoch ms
};

const H_NO_STORE = { "Cache-Control": "no-store" } as const;

function hWithReqId(req: Request, extra?: Record<string, string>) {
  const rid = req.headers.get("x-req-id") || "";
  return new Headers({ ...H_NO_STORE, ...(extra || {}), ...(rid ? { "x-req-id": rid } : {}) });
}

// Minimal Upstash REST client (ENV-only). No memory fallback.
async function upstashPipeline(cmds: (string | string[])[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("UPSTASH env missing");
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json() as Promise<Array<{ result: unknown }>>;
}

function parseIntEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ${name} missing`);
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`ENV ${name} invalid`);
  return n;
}

function log(req: Request, data: Record<string, unknown>) {
  // {reqId,pairId,anonId,role,op,phase,latencyMs,outcome}
  const rid = req.headers.get("x-req-id") || "";
  console.log(JSON.stringify({ reqId: rid, role: "server", ...data }));
}

export async function OPTIONS(req: Request) {
  await cookies(); // policy: always await
  return new Response(null, { status: 204, headers: hWithReqId(req) });
}

/**
 * GET: consume single prev-for item for caller anon
 * Headers:
 *  - x-anon-id: required
 * Env:
 *  - PREV_TTL_SEC: required (no defaults)
 * Storage key: rtc:prev-for:<anon> = JSON {peerAnonId,pairId,ts}
 * Behavior:
 *  - If missing/expired/self-match -> 204
 *  - If valid -> 200 {ok:true, found:true, pairId, peerAnonId}
 */
export async function GET(req: Request) {
  const t0 = Date.now();
  await cookies(); // policy: always await

  const headers = hWithReqId(req, { "Content-Type": "application/json; charset=utf-8" });
  const anon = (req.headers.get("x-anon-id") || "").trim();

  if (!anon) {
    log(req, { op: "prev/for", phase: "validate", outcome: "bad-request", latencyMs: Date.now() - t0 });
    return new Response(JSON.stringify({ ok: false, error: "missing-anon" }), { status: 400, headers });
  }

  let ttlSec: number;
  try {
    ttlSec = parseIntEnv("PREV_TTL_SEC");
  } catch (e) {
    log(req, { op: "prev/for", phase: "env", outcome: "server-error", msg: String(e), latencyMs: Date.now() - t0 });
    return new Response(JSON.stringify({ ok: false, error: "server-env" }), { status: 500, headers });
  }

  const key = `rtc:prev-for:${anon}`;

  // Try GETDEL first. If unsupported, fallback to GET + DEL.
  let recStr: string | null = null;
  try {
    const r = await upstashPipeline([["GETDEL", key]]);
    recStr = (r?.[0]?.result as string) ?? null;
  } catch {
    const r = await upstashPipeline([["GET", key], ["DEL", key]]);
    recStr = (r?.[0]?.result as string) ?? null;
  }

  if (!recStr) {
    log(req, { op: "prev/for", phase: "fetch", outcome: "no-prev", anonId: anon, latencyMs: Date.now() - t0 });
    return new Response(null, { status: 204, headers: hWithReqId(req) });
  }

  let rec: PrevRecord | null = null;
  try {
    rec = JSON.parse(recStr) as PrevRecord;
  } catch {
    // Corrupt payload → treat as empty
    log(req, { op: "prev/for", phase: "parse", outcome: "corrupt", anonId: anon, latencyMs: Date.now() - t0 });
    return new Response(null, { status: 204, headers: hWithReqId(req) });
  }

  // Validate TTL window and self-match
  const tooOld = Date.now() - (rec?.ts ?? 0) > ttlSec * 1000;
  const selfMatch = rec?.peerAnonId === anon;

  if (tooOld || selfMatch) {
    log(req, {
      op: "prev/for",
      phase: "validate",
      outcome: tooOld ? "expired" : "self-match",
      anonId: anon,
      pairId: rec?.pairId,
      latencyMs: Date.now() - t0,
    });
    return new Response(null, { status: 204, headers: hWithReqId(req) });
  }

  // Success
  const body = { ok: true, found: true, pairId: rec.pairId, peerAnonId: rec.peerAnonId };
  log(req, { op: "prev/for", phase: "done", outcome: "200", anonId: anon, pairId: rec.pairId, latencyMs: Date.now() - t0 });
  return new Response(JSON.stringify(body), { status: 200, headers });
}
