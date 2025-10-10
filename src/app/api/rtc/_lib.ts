// Shared RTC API helpers + inline Upstash client.
// No external re-exports. Named exports only.

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// ===== runtime flags =====
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "iad1"];

// ===== req-id + no-store =====
export function reqId(req: Request): string {
  return req.headers.get("x-req-id") || "";
}
export function hNoStore(req: Request, extra?: Record<string, string>) {
  const rid = reqId(req);
  const base: Record<string, string> = { "Cache-Control": "no-store" };
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

// ===== anon cookie <-> header stabilization =====
const ANON_COOKIE = "anon";
const ALG = "sha256";
function hmac(data: string): string {
  const key = process.env.ANON_SIGNING_SECRET || "";
  return crypto.createHmac(ALG, key).update(data).digest("base64url");
}
function packSigned(id: string) {
  if (!id) return "";
  return `${id}.${hmac(id)}`;
}
function unpackSigned(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw);
  const dot = s.lastIndexOf(".");
  if (dot <= 0) return s; // accept legacy plain value
  const id = s.slice(0, dot);
  const sig = s.slice(dot + 1);
  try {
    if (sig && hmac(id) === sig) return id;
  } catch {}
  return null;
}

/** Prefer x-anon-id, else signed anon cookie, else null. */
export function anonFrom(req: NextRequest): string | null {
  const hdr = req.headers.get("x-anon-id");
  if (hdr && hdr.trim()) return hdr.trim();
  const ck = req.cookies.get(ANON_COOKIE)?.value;
  const id = unpackSigned(ck);
  if (id && id.trim()) return id.trim();
  return null;
}

/** If header present and differs from cookie, overwrite cookie to header (signed). */
export async function stabilizeAnonCookieToHeader(
  req: NextRequest,
  resHeaders: Headers
): Promise<string | null> {
  await cookies();
  const headerId = (req.headers.get("x-anon-id") || "").trim();
  const cookieRaw = req.cookies.get(ANON_COOKIE)?.value || "";
  const cookieId = unpackSigned(cookieRaw) || "";

  if (!headerId) return cookieId || null;
  if (cookieId === headerId) return headerId;

  const signed = packSigned(headerId);
  const parts = [
    `${ANON_COOKIE}=${signed}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  resHeaders.append("Set-Cookie", parts.join("; "));
  return headerId;
}

// ===== unified OPTIONS =====
export async function options204(req: NextRequest) {
  await cookies();
  return new NextResponse(null, { status: 204, headers: hNoStore(req) });
}

// ===== minimal logger =====
type LogFields = Record<string, unknown>;
export function logRTC(route: string, f: LogFields) {
  try {
    console.log(
      JSON.stringify({
        ts: Date.now(),
        route,
        ...f,
      })
    );
  } catch {}
}

// ===== Minimal Upstash REST client (R) =====
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
function flatObject(o: Record<string, string | number>) {
  const a: (string | number)[] = [];
  for (const k of Object.keys(o)) a.push(k, o[k]!);
  return a;
}

export const R = {
  // strings
  async get(key: string): Promise<string | null> {
    return await upstash(["GET", key]);
  },
  async set(key: string, val: string, exSec?: number): Promise<"OK" | null> {
    return exSec ? await upstash(["SET", key, val, "EX", exSec]) : await upstash(["SET", key, val]);
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

  // hashes
  async hset(key: string, obj: Record<string, string | number>): Promise<number> {
    return await upstash(["HSET", key, ...flatObject(obj)]);
  },
  async hget(key: string, field: string): Promise<string | null> {
    return await upstash(["HGET", key, field]);
  },
  async hgetall(key: string): Promise<Record<string, string> | null> {
    const res = (await upstash(["HGETALL", key])) as Array<string> | null;
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
  async zrange(key: string, start: number, stop: number, withScores = false): Promise<any> {
    return withScores ? await upstash(["ZRANGE", key, start, stop, "WITHSCORES"]) : await upstash(["ZRANGE", key, start, stop]);
  },
  async zrevrange(key: string, start: number, stop: number, withScores = false): Promise<any> {
    return withScores ? await upstash(["ZREVRANGE", key, start, stop, "WITHSCORES"]) : await upstash(["ZREVRANGE", key, start, stop]);
  },
  async zscore(key: string, member: string): Promise<string | null> {
    return await upstash(["ZSCORE", key, member]);
  },
};
