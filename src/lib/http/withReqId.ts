import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Echo x-req-id if present, else generate. Enforce no-store.
 * Cast headers() to any to support environments where types suggest Promise.
 */
export function withReqId<R extends NextResponse>(res: R): R {
  const getHeaders = (headers as unknown as () => any);
  let id: string | null = null;

  try {
    const h: any = getHeaders();
    id = typeof h?.get === "function" ? (h.get("x-req-id") ?? null) : null;
  } catch {
    id = null;
  }

  if (!id) id = res.headers.get("x-req-id");
  if (!id) id = (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));

  res.headers.set("x-req-id", id as string);
  if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
  return res;
}
