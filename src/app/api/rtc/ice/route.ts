// Route: /api/rtc/ice
// Policies: preferredRegion, runtime/dynamic/revalidate, await cookies(), no-store, OPTIONS=204, echo x-req-id
export const preferredRegion = ["fra1","iad1"];
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { extractAnonId } from "@/lib/rtc/auth";
import { get, lpush, lrange, ltrim, expire } from "@/lib/rtc/upstash";

// -------- helpers --------
const H_NO_STORE: Record<string,string> = { "Cache-Control":"no-store" };
function hWithReqId(req: Request, extra?: Record<string,string>) {
  const rid = req.headers.get("x-req-id") || "";
  return new Headers({ ...H_NO_STORE, ...(extra||{}), ...(rid?{ "x-req-id": rid }:{}) });
}
function noStoreJson(req: Request, body: any, init?: number|ResponseInit) {
  const r = NextResponse.json(body, typeof init==="number"?{status:init}:init);
  r.headers.set("Cache-Control","no-store");
  const rid = req.headers.get("x-req-id"); if (rid) r.headers.set("x-req-id", rid);
  return r;
}
function noStoreEmpty(req: Request, status: number) {
  const r = new NextResponse(null, { status });
  r.headers.set("Cache-Control","no-store");
  const rid = req.headers.get("x-req-id"); if (rid) r.headers.set("x-req-id", rid);
  return r;
}
function log(req: Request, data: Record<string,unknown>) {
  const rid = req.headers.get("x-req-id") || "";
  console.log(JSON.stringify({ reqId: rid, role: "server", ...data }));
}
function parseIceGraceSec(): number {
  const v = process.env.ICE_GRACE;
  if (!v) return 0;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 5); // ≤5s
}
function sizeOk(candidate: any): boolean {
  try {
    const s = JSON.stringify(candidate);
    return Buffer.byteLength(s, "utf8") <= 4 * 1024; // ICE ≤ ~4KB
  } catch { return false; }
}
async function auth(anon: string, pairId: string) {
  const map = await get(`rtc:pair:map:${anon}`);
  if (!map) return null;
  const [pid, role] = String(map).split("|");
  return pid === pairId ? (role as "caller"|"callee") : null;
}

// -------- OPTIONS --------
export async function OPTIONS(req: NextRequest) {
  await cookies();
  return new Response(null, { status: 204, headers: hWithReqId(req) });
}

// -------- POST: push ICE --------
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
  if (!role) return noStoreJson(req, { error: "forbidden" }, 403);

  const me = role === "caller" ? "a" : "b";
  const key = `rtc:pair:${pairId}:ice:${me}`;

  try {
    const items = await lrange(key, 0, 49);
    if (!items || items.length === 0) {
      log(req, { op: "ice", phase: "poll", outcome: "204-empty", anonId: anon, pairId, latencyMs: Date.now() - t0 });
      return noStoreEmpty(req, 204);
    }
    await ltrim(key, items.length, -1);
    await expire(`rtc:pair:${pairId}`, 150);
    const body = items.map((s) => JSON.parse(s as string));
    log(req, { op: "ice", phase: "poll", outcome: "200", count: body.length, anonId: anon, pairId, latencyMs: Date.now() - t0 });
    return noStoreJson(req, body, 200);
  } catch (e) {
    log(req, { op: "ice", phase: "error", outcome: "500", msg: String(e), anonId: anon, pairId, latencyMs: Date.now() - t0 });
    return noStoreJson(req, { error: "ice-get-fail" }, 500);
  }
}
