// src/app/api/rtc/_lib.ts
// Helper: Upstash wrapper + response helpers + anon extract + logging for RTC

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";

/* ---------- Headers / Responses (no-store + echo x-req-id) ---------- */
export function rid(req: Request): string { return req.headers.get("x-req-id") || ""; }
export function hNoStore(req: Request, extra?: Record<string, string>): Headers {
  const h = new Headers({ "Cache-Control": "no-store", ...(extra || {}) });
  const r = rid(req); if (r) h.set("x-req-id", r);
  return h;
}
export function rjson(req: Request, body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), { status, headers: hNoStore(req, { "content-type": "application/json" }) });
}
export function rempty(req: Request, status = 204) {
  return new NextResponse(null, { status, headers: hNoStore(req) });
}

/* ---------- Upstash Redis (REST, single-command POST body = ["CMD", ...]) ---------- */
const RURL = process.env.UPSTASH_REDIS_REST_URL!;
const RTOK = process.env.UPSTASH_REDIS_REST_TOKEN!;

async function rexec(cmd: (string | number)[]) {
  const res = await fetch(RURL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${RTOK}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || res.statusText);
  return j?.result;
}

export const R = {
  async get(key: string) { return await rexec(["GET", key]); },
  async set(key: string, val: string) { return await rexec(["SET", key, val]); },
  async del(key: string) { return await rexec(["DEL", key]); },
  async exists(key: string) { return Number(await rexec(["EXISTS", key])) || 0; },
  async expire(key: string, seconds: number) { return await rexec(["EXPIRE", key, seconds]); },
  async hgetall(key: string): Promise<Record<string, string>> {
    const arr = (await rexec(["HGETALL", key])) as any[] | null;
    if (!Array.isArray(arr)) return {};
    const out: Record<string, string> = {};
    for (let i = 0; i < arr.length; i += 2) out[String(arr[i])] = String(arr[i + 1]);
    return out;
  },
  async hset(key: string, fields: Record<string, any>) {
    const args: (string | number)[] = ["HSET", key];
    for (const [k, v] of Object.entries(fields)) args.push(k, typeof v === "string" ? v : JSON.stringify(v));
    return await rexec(args);
  },
  async setNxPx(key: string, val: string, ttlMs: number) {
    // SET key value NX PX ttl
    return (await rexec(["SET", key, val, "NX", "PX", ttlMs])) === "OK";
  },
  async zcard(key: string) { return Number(await rexec(["ZCARD", key])) || 0; },
  async lpush(key: string, val: string) { return await rexec(["LPUSH", key, val]); },
  async lrange(key: string, start: number, stop: number) { return (await rexec(["LRANGE", key, start, stop])) as string[]; },
  async ltrim(key: string, start: number, stop: number) { return await rexec(["LTRIM", key, start, stop]); },
};

/* ---------- anon extract (header or signed cookie) ---------- */
export async function anonFrom(req: NextRequest): Promise<string | null> {
  // Ensure cookie materialization
  await cookies();
  // 1) explicit header wins (useful in tests)
  const hdr = (req.headers.get("x-anon-id") || "").trim();
  if (hdr) return hdr;

  // 2) cookie names commonly used
  const cks = ["anon", "anonId", "aid", "ditona_anon"];
    const jar = await cookies();
  for (const n of cks) {
    const v = jar.get(n)?.value;
    if (!v) continue;
    // Accept plain or v1.<id>.<hmac>
    const parts = v.split(".");
    if (parts.length === 3 && parts[0] === "v1" && process.env.ANON_SIGNING_SECRET) {
      const id = parts[1], sig = parts[2];
      try {
        const hs = createHmac("sha256", process.env.ANON_SIGNING_SECRET).update(id).digest("hex");
        if (hs === sig) return id;
      } catch { return id; }
    }
    return v;
  }
  return null;
}

/* ---------- uniform logging ---------- */
export function logRTC(fields: Record<string, any>) {
  try {
    const base = { ts: new Date().toISOString(), mod: "rtc" };
    console.log(JSON.stringify({ ...base, ...fields }));
  } catch { /* no-op */ }
}
// ---- Compatibility shims for legacy imports (enqueue/others) ----
import type { NextRequest, NextResponse } from "next/server";

// OPTIONS handler returning 204 + no-store (legacy name)
export function optionsHandler(req: NextRequest) {
  return new Response(null, { status: 204, headers: hNoStore(req) });
}

// Attach no-store and echo x-req-id to an existing response (legacy name)
export function withCommon(res: NextResponse, ridStr?: string) {
  try {
    res.headers.set("Cache-Control", "no-store");
    if (ridStr) res.headers.set("x-req-id", ridStr);
  } catch {}
  return res;
}

// Logger alias (legacy name)
export const logEvt = logRTC;

// Get anon or throw (legacy name)
export async function getAnonOrThrow(req: NextRequest): Promise<string> {
  const a = await anonFrom(req);
  if (!a) throw new Error("anon-required");
  return a;
}
