import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Wrap a NextResponse to:
 * - echo incoming x-req-id (or generate one)
 * - enforce no-store
 */
export function withReqId<R extends NextResponse>(res: R): R {
  const h = headers();
  const id = h.get("x-req-id") ?? (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
  res.headers.set("x-req-id", id);
  // keep API responses non-cacheable regardless of CDN edge
  if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
  return res;
}
