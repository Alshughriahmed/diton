// src/app/api/rtc/_lib.ts
// Shared RTC API helpers: runtime/dynamic headers, anon identity stabilization,
// no-store responses with x-req-id echo, OPTIONS handler, and legacy re-exports.

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// ===== runtime flags (project rules) =====
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1","iad1"]; // no "as const"

// ===== req-id + no-store =====
export function reqId(req: Request): string {
  return req.headers.get("x-req-id") || "";
}
export function noStoreHeaders(req: Request, extra?: Record<string, string>) {
  const rid = reqId(req);
  const base: Record<string, string> = { "Cache-Control": "no-store" };
  if (rid) base["x-req-id"] = rid;
  return new Headers({ ...base, ...(extra || {}) });
}
export function rjson(req: Request, body: any, status = 200) {
  return new NextResponse(JSON.stringify(body ?? {}), {
    status,
    headers: noStoreHeaders(req, { "content-type": "application/json" }),
  });
}
export function rempty(req: Request, status = 204) {
  return new NextResponse(null, { status, headers: noStoreHeaders(req) });
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
function unpackSigned(raw: string | undefined | null): string | null {
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
  await cookies(); // comply with project rule
  const headerId = (req.headers.get("x-anon-id") || "").trim();
  const cookieRaw = req.cookies.get(ANON_COOKIE)?.value || "";
  const cookieId = unpackSigned(cookieRaw) || "";

  if (!headerId) return cookieId || null;      // header missing -> keep cookie
  if (cookieId === headerId) return headerId;  // already in sync

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
  return new NextResponse(null, { status: 204, headers: noStoreHeaders(req) });
}

// ===== legacy compatibility re-exports =====
// Keep existing imports working without touching other files.
export { R } from "@/lib/rtc/upstash";       // Upstash REST wrapper
export { logRTC } from "@/lib/rtc/logger";   // structured logger
export const hNoStore = noStoreHeaders;      // alias
