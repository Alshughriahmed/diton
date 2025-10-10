// Shared RTC API helpers + inline Upstash REST client (pipeline).
// Named exports only. No new ENV. No external deps.
// Conforms to k.md shims and current project imports.  (see citations)

// ----------------- imports -----------------
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// ----------------- constants -----------------
const ANON_COOKIE = "anon";
const HMAC_ALG = "sha256";
const ONE_YEAR = 60 * 60 * 24 * 365;

// ----------------- req-id + no-store -----------------
export function reqId(req: Request): string {
  return req.headers.get("x-req-id") || "";
}

export function hNoStore(req: Request, extra?: Record<string, string>) {
  const base: Record<string, string> = { "Cache-Control": "no-store" };
  const rid = reqId(req);
  if (rid) base["x-req-id"] = rid;
  return new Headers({ ...base, ...(extra || {}) });
}

export function rjson(req: Request, body: any, status = 200) {
  return new NextResponse(JSON.stringify(body ?? {}), {
    status,
    headers: hNoStore(req, { "content-type": "application/json" }),
  });
}

export function rempty(req: Request, status = 204) {
  return new NextResponse(null, { status, headers: hNoStore(req) });
}

// ----------------- anon identity -----------------
function hmac(data: string): string {
  const key = process.env.ANON_SIGNING_SECRET || "";
  return crypto.createHmac(HMAC_ALG, key).update(data).digest("base64url");
}

/** Accepts legacy (plain id), "id.sig", or "v1.id.sig". Returns id or null. */
function unpackSigned(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Accept "v1.<id>.<sig>" or "<id>.<sig>" or plain id
  const parts = s.startsWith("v1.") ? s.split(".").slice(1) : s.split(".");
  if (parts.length === 1) return parts[0] || null; // legacy plain id

  const id = parts[0] || "";
  const sig = parts[1] || "";
  try {
    if (id && sig && hmac(id) === sig) return id;
  } catch {}
  return null;
}

/** Pack as "v1.<id>.<sig>" */
function packSigned(id: string): string {
  return `v1.${id}.${hmac(id)}`;
}

/** Prefer x-anon-id header; else signed cookie; else null. */
export function anonFrom(req: NextRequest): string | null {
  const hdr = (req.headers.get("x-anon-id") || "").trim();
  if (hdr) return hdr;

  const ck = req.cookies.get(ANON_COOKIE)?.value || "";
  const id = unpackSigned(ck);
  if (id) return id;

  return null;
}

/** Build a Set-Cookie string for the anon cookie (no domain; valid for all hosts). */
function buildAnonSetCookie(id: string): string {
  const signed = packSigned(id);
  const parts = [
    `${ANON_COOKIE}=${signed}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${ONE_YEAR}`,
  ];
  return parts.join("; ");
}

/**
 * Ensure anon cookie exists (or align it to header if header provided).
 * Returns anonId. If resHeaders is provided, writes Set-Cookie into it.
 * Never uses cookies().set() — write via Set-Cookie only (per project rule).
 */
export async function ensureAnonCookie(
  req: NextRequest,
  resHeaders?: Headers
): Promise<string> {
  await cookies(); // required by project rule

  const headerId = (req.headers.get("x-anon-id") || "").trim();
  const cookieRaw = req.cookies.get(ANON_COOKIE)?.value || "";
  const cookieId = unpackSigned(cookieRaw) || "";

  // choose id: prefer header if present, else existing cookie, else new
  const chosen = headerId || cookieId || crypto.randomUUID();

  // set cookie only if missing or mismatched
  if (!cookieId || cookieId !== chosen) {
    if (resHeaders) resHeaders.append("Set-Cookie", buildAnonSetCookie(chosen));
  }
  return chosen;
}

/**
 * If header present and differs from cookie → overwrite cookie to header (signed).
 * Writes Set-Cookie into resHeaders. Returns chosen id (header or cookie) or null.
 */
export async function stabilizeAnonCookieToHeader(
  req: NextRequest,
  resHeaders: Headers
): Promise<string | null> {
  await cookies(); // required by project rule

  const headerId = (req.headers.get("x-anon-id") || "").trim();
  const cookieRaw = req.cookies.get(ANON_COOKIE)?.value || "";
  const cookieId = unpackSigned(cookieRaw) || "";

  if (headerId && headerId !== cookieId) {
    resHeaders.append("Set-Cookie", buildAnonSetCookie(headerId));
    return headerId;
  }
  return headerId || cookieId || null;
}

export function getAnonOrThrow(req: NextRequest): string {
  const id = anonFrom(req);
  if (id && id.trim()) return id.trim();
  throw new Error("anon-missing");
}

// ----------------- OPTIONS handler shims -----------------
export async function options204(req: NextRequest) {
  await cookies(); // project rule
  return new NextResponse(null, { status: 204, headers: hNoStore(req) });
}
export const optionsHandler = options204;

// ----------------- logging -----------------
type LogFields = Record<string, unknown>;

/** Flexible logger: logRTC("route", {...}) or logRTC({ route:"/api/...", status:200 }) */
export function logRTC(arg1: string | LogFields, fields?: LogFields) {
  const base =
    typeof arg1 === "string" ? { route: arg1, ...(fields || {}) } : (arg1 || {});
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), ...base }));
  } catch {}
}

/** Convenience alias used by routes */
export function logEvt(fields: LogFields) {
  logRTC(fields);
}

// ----------------- Upstash REST /pipeline client -----------------
const U = process.env.UPSTASH_REDIS_REST_URL || "";
const T = process.env.UPSTASH_REDIS_REST_TOKEN || "";

async function upstash(cmd: (string | number)[]) {
  if (!U || !T) throw new Error("Upstash ENV missing");
  const res = await fetch(`${U}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${T}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([cmd]),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const arr = (await res.json()) as Array<{ result: any; error?: string }>;
  const it = arr?.[0];
  if (!it) return null;
  if (it.error) throw new Error(it.error);
  return it.result ?? null;
}

function flatten(obj: Record<string, string | number>) {
  const a: (string | number)[] = [];
  for (const k of Object.keys(obj)) a.push(k, obj[k]!);
  return a;
}

export const R = {
  // strings
  async get(key: string): Promise<string | null> {
    return await upstash(["GET", key]);
  },
  async set(key: string, val: string, exSec?: number): Promise<"OK" | null> {
    return exSec
      ? await upstash(["SET", key, val, "EX", exSec])
      : await upstash(["SET", key, val]);
  },
  async del(key: string): Promise<number> {
    return await upstash(["DEL", key]);
  },
  async expire(key: string, sec: number): Promise<number> {
    return await upstash(["EXPIRE", key, sec]);
  },
  async ttl(key: string): Promise<number> {
    return await upstash(["TTL", key]);
  },
  async setNxPx(key: string, val: string, pxMs: number): Promise<boolean> {
    const r = await upstash(["SET", key, val, "NX", "PX", pxMs]);
    return r === "OK";
  },
  async exists(key: string): Promise<boolean> {
    const n = Number(await upstash(["EXISTS", key])) || 0;
    return n > 0;
  },

  // hashes
  async hset(key: string, obj: Record<string, string | number>): Promise<number> {
    return await upstash(["HSET", key, ...flatten(obj)]);
  },
  async hget(key: string, field: string): Promise<string | null> {
    return await upstash(["HGET", key, field]);
  },
  async hgetall(key: string): Promise<Record<string, string> | null> {
    const res = (await upstash(["HGETALL", key])) as string[] | null;
    if (!res) return null;
    const out: Record<string, string> = {};
    for (let i = 0; i < res.length; i += 2) out[res[i]] = res[i + 1];
    return out;
  },

  // sorted sets
  async zadd(key: string, score: number, member: string): Promise<number> {
    return await upstash(["ZADD", key, score, member]);
  },
  async zrem(key: string, member: string): Promise<number> {
    return await upstash(["ZREM", key, member]);
  },
  async zcard(key: string): Promise<number> {
    return await upstash(["ZCARD", key]);
  },
  async zrange(
    key: string,
    start: number,
    stop: number,
    withScores = false
  ): Promise<any> {
    return withScores
      ? await upstash(["ZRANGE", key, start, stop, "WITHSCORES"])
      : await upstash(["ZRANGE", key, start, stop]);
  },
  async zrevrange(
    key: string,
    start: number,
    stop: number,
    withScores = false
  ): Promise<any> {
    return withScores
      ? await upstash(["ZREVRANGE", key, start, stop, "WITHSCORES"])
      : await upstash(["ZREVRANGE", key, start, stop]);
  },
  async zscore(key: string, member: string): Promise<string | null> {
    return await upstash(["ZSCORE", key, member]);
  },
};

// ----------------- Redis key helpers -----------------
export const kAttrs = (anon: string) => `rtc:attrs:${anon}`;
export const kFilters = (anon: string) => `rtc:filters:${anon}`;
export const kPairMap = (anon: string) => `rtc:pair:map:${anon}`;
export const kClaim = (anon: string) => `rtc:claim:${anon}`;
export const kLast = (anon: string) => `rtc:last:${anon}`;

// ----------------- normalizers -----------------
function pickPrimitives(obj: any): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (["string", "number", "boolean"].includes(typeof v)) out[k] = v as any;
  }
  return out;
}

/** Ensure { gender in ["male","female","couple","lgbt","u"], country UPPER, ts }. */
export function normalizeAttrs(input: any, nowMs = Date.now()) {
  const base = pickPrimitives(input);
  const g = String(base["gender"] ?? "").toLowerCase();
  const gender =
    g === "male" || g === "m"
      ? "male"
      : g === "female" || g === "f"
      ? "female"
      : g === "couple"
      ? "couple"
      : g === "lgbt"
      ? "lgbt"
      : "u";
  const countryRaw = String(base["country"] ?? "").trim();
  const country = countryRaw ? countryRaw.toUpperCase() : "";

  return { ...base, gender, country, ts: nowMs };
}

/** Filters: coerce gender/country to string arrays; keep other primitives only. */
export function normalizeFilters(input: any) {
  const base = pickPrimitives(input);
  const g = (base["gender"] as any) ?? (base["genders"] as any);
  const c = (base["country"] as any) ?? (base["countries"] as any);

  const gender = Array.isArray(g) ? g.map(String) : g ? [String(g)] : [];
  const country = Array.isArray(c)
    ? c.map((s) => String(s).toUpperCase())
    : c
    ? [String(c).toUpperCase()]
    : [];

  // remove possible alias fields to avoid duplication
  delete (base as any)["genders"];
  delete (base as any)["countries"];

  return { ...base, gender, country };
}

// ----------------- withCommon (two-call styles) -----------------
function forwardSetCookies(from: Headers, to: Headers) {
  from.forEach((val, key) => {
    if (key.toLowerCase() === "set-cookie") to.append("Set-Cookie", val);
  });
}

/** Internal runner used by both withCommon forms. */
async function runWithCommon(
  req: NextRequest,
  handler:
    | ((resHeaders: Headers) => Promise<NextResponse> | NextResponse)
    | ((req: NextRequest, resHeaders: Headers) => Promise<NextResponse> | NextResponse)
): Promise<NextResponse> {
  await cookies(); // project rule
  const resHeaders = new Headers();

  // Ensure anon is stable before route logic
  await stabilizeAnonCookieToHeader(req, resHeaders);
  await ensureAnonCookie(req, resHeaders);

  // Call handler in either (resHeaders) or (req, resHeaders) form
  const resp =
    handler.length >= 2
      ? await (handler as any)(req, resHeaders)
      : await (handler as any)(resHeaders);

  // Forward Set-Cookie from resHeaders into the actual response
  forwardSetCookies(resHeaders, resp.headers);
  return resp;
}

/**
 * withCommon(req, (resHeaders)=>NextResponse|Promise)
 * withCommon((req, resHeaders)=>NextResponse|Promise)  -> returns handler
 */
export function withCommon(
  arg1:
    | NextRequest
    | ((
        req: NextRequest,
        resHeaders: Headers
      ) => Promise<NextResponse> | NextResponse),
  maybeHandler?: (resHeaders: Headers) => Promise<NextResponse> | NextResponse
): any {
  if (typeof arg1 === "function") {
    // curry: return a route handler
    return async (req: NextRequest) => runWithCommon(req, arg1 as any);
  }
  // immediate call with (req, cb(resHeaders))
  const req = arg1 as NextRequest;
  const cb =
    maybeHandler as (resHeaders: Headers) => Promise<NextResponse> | NextResponse;
  return runWithCommon(req, cb as any);
}
