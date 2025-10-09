// src/app/api/rtc/_lib.ts
// Unified helpers: Upstash wrapper + responses (no-store + x-req-id) + anon + logging + legacy shims

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";

/* -----------------------------------------------------------------------------
   Runtime/Regions
----------------------------------------------------------------------------- */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"]; // بدون as const

/* -----------------------------------------------------------------------------
   Response helpers (always no-store + echo x-req-id)
----------------------------------------------------------------------------- */
function rid(req: Request): string { return req.headers.get("x-req-id") || ""; }
export function hNoStore(req: Request, extra?: Record<string,string>): Headers {
  const h = new Headers({ "Cache-Control": "no-store", ...(extra||{}) });
  const r = rid(req); if (r) h.set("x-req-id", r);
  return h;
}
export function rjson(req: Request, body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), { status, headers: hNoStore(req, { "content-type":"application/json" }) });
}
export function rempty(req: Request, status = 204) {
  return new NextResponse(null, { status, headers: hNoStore(req) });
}

/* -----------------------------------------------------------------------------
   Upstash Redis minimal REST wrapper
----------------------------------------------------------------------------- */
const RURL = process.env.UPSTASH_REDIS_REST_URL!;
const RTOK = process.env.UPSTASH_REDIS_REST_TOKEN!;

async function rexec(cmd: (string|number)[]) {
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
  async expire(key: string, seconds: number) { return await rexec(["EXPIRE", key, seconds]); },
  async exists(key: string) { return Number(await rexec(["EXISTS", key])) || 0; },

  async hgetall(key: string): Promise<Record<string,string>> {
    const arr = (await rexec(["HGETALL", key])) as any[] | null;
    if (!Array.isArray(arr)) return {};
    const out: Record<string,string> = {};
    for (let i=0;i<arr.length;i+=2) out[String(arr[i])] = String(arr[i+1]);
    return out;
  },
  async hset(key: string, fields: Record<string, any>) {
    const args: (string|number)[] = ["HSET", key];
    for (const [k,v] of Object.entries(fields)) args.push(k, typeof v==="string" ? v : JSON.stringify(v));
    return await rexec(args);
  },

  async setNxPx(key: string, val: string, ttlMs: number) {
    // SET key value NX PX ttl
    return (await rexec(["SET", key, val, "NX", "PX", ttlMs])) === "OK";
  },

  async zcard(key: string) { return Number(await rexec(["ZCARD", key])) || 0; },
  async zadd(key: string, score: number, member: string) { return await rexec(["ZADD", key, score, member]); },
  async zrange(key: string, start: number, stop: number) { return (await rexec(["ZRANGE", key, start, stop])) as string[]; },
  async zrem(key: string, member: string) { return await rexec(["ZREM", key, member]); },

  async lpush(key: string, val: string) { return await rexec(["LPUSH", key, val]); },
  async lrange(key: string, start: number, stop: number) { return (await rexec(["LRANGE", key, start, stop])) as string[]; },
  async ltrim(key: string, start: number, stop: number) { return await rexec(["LTRIM", key, start, stop]); },
};

/* -----------------------------------------------------------------------------
   Keys (namespace-locked to your allowed set)
----------------------------------------------------------------------------- */
export type Role = "caller" | "callee";
export type Gender = "m" | "f" | "u";
export type Country = string;

export const kQ         = "rtc:q";
export const kAttrs     = (anon: string)   => `rtc:attrs:${anon}`;
export const kFilters   = (anon: string)   => `rtc:filters:${anon}`;
export const kMatching  = (anon: string)   => `rtc:matching:${anon}`;
export const kPair      = (pairId: string) => `rtc:pair:${pairId}`;
export const kPairMap   = (anon: string)   => `rtc:pair:map:${anon}`;
export const kClaim     = (anon: string)   => `rtc:claim:${anon}`;
export const kLast      = (anon: string)   => `rtc:last:${anon}`;
export const kPrevFor   = (anon: string)   => `rtc:prev-for:${anon}`;
export const kPrevWish  = (anon: string)   => `rtc:prev-wish:${anon}`;
export const kIdem      = (pairId: string, role: Role, tag: string) => `rtc:idem:${pairId}:${role}:${tag}`;

/* -----------------------------------------------------------------------------
   Attrs / Filters normalizers (expected by enqueue)
----------------------------------------------------------------------------- */
export interface Attrs { gender: Gender; country: Country; ts: number; }
export interface Filters {
  filterGenders: "all" | Gender[];
  filterCountries: "ALL" | Country[];
  ts: number;
}

export function normalizeAttrs(obj: any): Attrs {
  const gender: Gender = (obj?.gender ?? "u") as Gender;
  const country: Country = (obj?.country ?? "XX") as Country;
  return { gender, country, ts: Date.now() };
}

export function normalizeFilters(obj: any): Filters {
  const g = obj?.filterGenders ?? "all";
  const c = obj?.filterCountries ?? "ALL";
  const filterGenders: "all" | Gender[] = g === "all" ? "all" : (Array.isArray(g) ? g : [g]);
  const filterCountries: "ALL" | Country[] = c === "ALL" ? "ALL" : (Array.isArray(c) ? c : [c]);
  return { filterGenders, filterCountries, ts: Date.now() };
}

/* -----------------------------------------------------------------------------
   anon extraction (header or signed cookie). Always await cookies().
----------------------------------------------------------------------------- */
export async function anonFrom(req: NextRequest): Promise<string|null> {
  await cookies(); // materialize
  const hdr = (req.headers.get("x-anon-id") || "").trim();
  if (hdr) return hdr;

  const jar = await cookies();
  const names = ["anon","anonId","aid","ditona_anon"];
  for (const n of names) {
    const v = jar.get(n)?.value;
    if (!v) continue;
    const parts = v.split(".");
    if (parts.length === 3 && parts[0] === "v1" && process.env.ANON_SIGNING_SECRET) {
      const id = parts[1], sig = parts[2];
      try {
        const hs = createHmac("sha256", process.env.ANON_SIGNING_SECRET).update(id).digest("hex");
        if (hs === sig) return id;
      } catch { return parts[1] || v; }
    }
    return v;
  }
  return null;
}

export async function getAnonOrThrow(req: NextRequest): Promise<string> {
  const a = await anonFrom(req);
  if (!a) throw new Error("anon-required");
  return a;
}

/* -----------------------------------------------------------------------------
   Logging (uniform JSON)
----------------------------------------------------------------------------- */
export function logRTC(fields: Record<string, any>) {
  try { console.log(JSON.stringify({ ts: new Date().toISOString(), mod: "rtc", ...fields })); } catch {}
}
// legacy alias
export const logEvt = logRTC;

/* -----------------------------------------------------------------------------
   Legacy shims expected by existing routes
----------------------------------------------------------------------------- */
export function optionsHandler(req: NextRequest) {
  return new Response(null, { status: 204, headers: hNoStore(req) });
}
export function withCommon(res: NextResponse, ridStr?: string) {
  try {
    res.headers.set("Cache-Control", "no-store");
    if (ridStr) res.headers.set("x-req-id", ridStr);
  } catch {}
  return res;
}

// Legacy JSON helpers
export function J(status: number, body: any, _rid?: string) {
  // _rid kept for compatibility. x-req-id already echoed by callers using headers.
  // We don't have Request here, so produce generic JSON response without mirror of req headers.
  return new NextResponse(JSON.stringify(body), { status, headers: new Headers({ "Cache-Control":"no-store","content-type":"application/json" }) });
}
export function NC(status = 204, _rid?: string) {
  return new NextResponse(null, { status, headers: new Headers({ "Cache-Control":"no-store" }) });
}
export function BAD(msg = "bad request", _rid?: string) { return J(400, { error: msg }); }
export function FORB(msg = "forbidden", _rid?: string) { return J(403, { error: msg }); }
export function CONFLICT(msg = "conflict", _rid?: string) { return J(409, { error: msg }); }
export function TOOLARGE(msg = "payload too large", _rid?: string) { return J(413, { error: msg }); }
