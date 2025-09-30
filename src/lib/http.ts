// Central HTTP helpers for API routes (A1)
import { NextResponse } from "next/server";

export function noStore<T extends Response>(r: T): T {
  try { r.headers?.set("Cache-Control","no-store"); } catch {}
  return r;
}

export function json(data: any, init: ResponseInit = {}) {
  return noStore(
    NextResponse.json(data, {
      ...init,
      headers: { ...(init.headers || {}), "Cache-Control": "no-store" }
    })
  );
}

export function text(s: string, init: ResponseInit = {}) {
  return noStore(
    new Response(s, {
      ...init,
      headers: { ...(init.headers || {}), "Cache-Control": "no-store" }
    })
  );
}
