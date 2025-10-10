// Force cookies + no-store + x-req-id + x-anon-id (if known)
"use client";
import { getAnonId } from "./anonState";

export default async function apiSafeFetch(
  input: RequestInfo | URL,
  init: (RequestInit & { timeoutMs?: number }) = {}
): Promise<Response> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), init.timeoutMs ?? 12000);

  const h = new Headers(init.headers || {});
  if (!h.has("x-req-id")) h.set("x-req-id", genId());

  const aid = getAnonId();
  if (aid && !h.has("x-anon-id")) h.set("x-anon-id", aid);

  try {
    const res = await fetch(input, {
      ...init,
      cache: "no-store",
      credentials: "include",
      keepalive: true,
      signal: controller.signal,
      headers: h,
    });
    return res;
  } finally {
    clearTimeout(to);
  }
}

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4); }
