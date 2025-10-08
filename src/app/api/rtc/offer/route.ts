// Route: /api/rtc/offer
// Policies: ENV-only, no-store, OPTIONS=204, echo x-req-id, await cookies(), preferredRegion=["fra1","iad1"]

export const preferredRegion = ["fra1", "iad1"]; // بلا as const
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { get, setNxPx, expire } from "@/lib/rtc/upstash";
import { createHash } from "node:crypto";

const H_NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };

function hWithReqId(req: Request, extra?: Record<string, string>) {
  const rid = req.headers.get("x-req-id") || "";
  return new Headers({ ...H_NO_STORE, ...(extra || {}), ...(rid ? { "x-req-id": rid } : {}) });
}

function noStoreJson(req: Request, body: any, init?: number | ResponseInit) {
  const r = NextResponse.json(body, typeof init === "number" ? { status: init } : init);
  r.headers.set("Cache-Control", "no-store");
  const rid = req.headers.get("x-req-id");
  if (rid) r.headers.set("x-req-id", rid);
  return r;
}

function noStoreEmpty(req: Request, status: number) {
  const r = new NextResponse(null, { status });
  r.headers.set("Cache-Control", "no-store");
  const rid = req.headers.get("x-req-id");
  if (rid) r.headers.set("x-req-id", rid);
  return r;
}

function log(req: Request, data: Record<string, unknown>) {
  const rid = req.headers.get("x-req-id") || "";
  console.log(JSON.stringify({ reqId: rid, role: "server", ...data }));
}

async function auth(anon: string, pairId: string) {
  const map = await get(`rtc:pair:map:${anon}`);
  if (!map) return null;
  const [pid, role] = String(map).split("|");
  return pid === pairId ? role : null;
}

export async function OPTIONS(req: NextRequest) {
  await cookies(); // التزام بالقواعد
  return new Response(null, { status: 204, headers: hWithReqId(req) });
}

/**
 * Idempotent POST /offer
 * المفتاح: rtc:idem:<pairId>:<role>:<sdpTag> مع TTL=45s
 * - أول طلب يمر: يكتب offer بقفل NX (120s)
 * - التكرارات خلال 45s تعيد 204 بلا آثار جانبية
 */
export async function POST(req: NextRequest) {
  const t0 = Date.now();
  await cookies();

  const anon = extractAnonId(req);
  if (!anon) return noStoreJson(req, { error: "anon-required" }, 403);

  const payload = await req.json().catch(() => ({} as any));
  const pairId: string | undefined = payload?.pairId;
  const sdp: string | undefined = payload?.sdp;
  if (!pairId || !sdp) return noStoreJson(req, { error: "bad-input" }, 400);

  const role = await auth(anon, pairId);
  if (role !== "caller") return noStoreJson(req, { error: "only-caller" }, 403);

  // sdpTag من الهيدر أو بصمة من sdp
  const hdr = req.headers;
  const sdpTagHdr = (hdr.get("x-sdp-tag") || "").trim();
  const sdpFp = createHash("sha256").update(String(sdp)).digest("hex").slice(0, 16);
  const sdpTag = sdpTagHdr || sdpFp;

  // Idempotency: TTL = 45s حسب التوجيه
  const idemKey = `rtc:idem:${pairId}:${role}:${sdpTag}`;
  const isFirst = await setNxPx(idemKey, "1", 45_000);

  if (!isFirst) {
    log(req, { op: "offer", phase: "idem", outcome: "repeat-204", pairId, anonId: anon, sdpTag, latencyMs: Date.now() - t0 });
    return noStoreEmpty(req, 204);
  }

  // كتابة الـoffer بقفل NX (يحمي من السباق)
  const offerKey = `rtc:pair:${pairId}:offer`;
  const ok = await setNxPx(offerKey, String(sdp), 120_000);
  if (!ok) {
    log(req, { op: "offer", phase: "write", outcome: "exists-409", pairId, anonId: anon, latencyMs: Date.now() - t0 });
    return noStoreJson(req, { error: "exists" }, 409);
  }

  await expire(`rtc:pair:${pairId}`, 150);
  log(req, { op: "offer", phase: "done", outcome: "204", pairId, anonId: anon, sdpTag, latencyMs: Date.now() - t0 });
  return noStoreEmpty(req, 204);
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  await cookies();

  const anon = extractAnonId(req);
  if (!anon) return noStoreJson(req, { error: "anon-required" }, 403);

  // NEW: read pairId from query OR header
  const url = new URL(req.url);
  const q = (url.searchParams.get("pairId") || "").trim();
  const h = (req.headers.get("x-pair-id") || "").trim();
  const pairId = q || h;
  if (!pairId) return noStoreJson(req, { error: "pair-required" }, 400);

  const role = await auth(anon, pairId);
  if (role !== "callee") return noStoreJson(req, { error: "only-callee" }, 403);

  const sdp = await get(`rtc:pair:${pairId}:offer`);
  if (!sdp) {
    log(req, { op: "offer", phase: "read", outcome: "204-no-offer", pairId, anonId: anon, latencyMs: Date.now() - t0 });
    return noStoreEmpty(req, 204);
  }

  await expire(`rtc:pair:${pairId}`, 150);
  log(req, { op: "offer", phase: "read", outcome: "200", pairId, anonId: anon, latencyMs: Date.now() - t0 });
  return noStoreJson(req, { sdp: String(sdp) }, 200);
}

