import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Echo incoming x-req-id (or generate) and enforce no-store.
 * Works whether headers() is async by awaiting it.
 */
export async function withReqId<R extends NextResponse>(res: R): Promise<R> {
  const h = await headers();
  const id =
    h.get("x-req-id") ??
    (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));

  res.headers.set("x-req-id", id);
  if (!res.headers.has("Cache-Control")) {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}
