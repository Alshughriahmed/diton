// Route: /api/rtc/prev/for
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"]; // بلا as const

import { cookies } from "next/headers";

type PrevRecord = { peerAnonId: string; pairId: string; ts: number };

const H_NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };

function hWithReqId(req: Request, extra?: Record<string, string>) {
  const rid = req.headers.get("x-req-id") || "";
  return new Headers({ ...H_NO_STORE, ...(extra || {}), ...(rid ? { "x-req-id": rid } : {}) });
}

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
  const rid = req.headers.get("x-req-id") || "";
  console.log(JSON.stringify({ reqId: rid, role: "server", ...data }));
}

export async function OPTIONS(req: Request) {
  await cookies();
  return new Response(null, { status: 204, headers: hWithReqId(req) });
}

// GET: يستهلك عنصر prev-for لمرة واحدة
// Header: x-anon-id مطلوب
// ENV: PREV_TTL_SEC
// Key: rtc:prev-for:<anon> = {peerAnonId,pairId,ts}
export async function GET(req: Request) {
  const t0 = Date.now();
  await cookies();

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
    log(req, { op: "prev/for", phase: "parse", outcome: "corrupt", anonId: anon, latencyMs: Date.now() - t0 });
    return new Response(null, { status: 204, headers: hWithReqId(req) });
  }

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

  const body = { ok: true, found: true, pairId: rec.pairId, peerAnonId: rec.peerAnonId };
  log(req, { op: "prev/for", phase: "done", outcome: "200", anonId: anon, pairId: rec.pairId, latencyMs: Date.now() - t0 });
  return new Response(JSON.stringify(body), { status: 200, headers });
}
