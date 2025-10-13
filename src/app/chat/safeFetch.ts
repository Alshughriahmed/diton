"use client";

type SafeInit = RequestInit & { timeoutMs?: number };

export default async function safeFetch(input: RequestInfo | URL, init: SafeInit = {}) {
  const url = typeof input === "string" ? input : String(input);
  const isRtc = url.includes("/api/rtc/");
  const method = (init.method || "GET").toUpperCase();

  // compose AbortController with optional external signal + timeout
  const ac = new AbortController();
  const ext = init.signal as AbortSignal | undefined;
  if (ext) {
    if (ext.aborted) ac.abort();
    else ext.addEventListener("abort", () => ac.abort(), { once: true });
  }
  const timeout = init.timeoutMs ?? 15000;
  const tm = setTimeout(() => ac.abort(), timeout);

  // headers
  const headers = new Headers(init.headers || undefined);
  const isApi = url.startsWith("/api/");
  const hasJsonishBody =
    init.body != null &&
    method !== "GET" &&
    method !== "HEAD" &&
    typeof init.body !== "string" &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof Blob);

  if (isApi && !headers.has("accept")) headers.set("accept", "application/json");
  if (isApi && hasJsonishBody && !headers.has("content-type")) headers.set("content-type", "application/json");

  // final init
  const finalInit: RequestInit = {
    ...init,
    method,
    headers,
    signal: ac.signal,
    cache: init.cache ?? "no-store",
    credentials: init.credentials ?? (isRtc ? "include" : "same-origin"),
  };

  // never send body on GET/HEAD
  if (method === "GET" || method === "HEAD") {
    delete (finalInit as any).body;
  } else if (hasJsonishBody) {
    (finalInit as any).body = JSON.stringify(init.body);
  }

  try {
    return await fetch(input as any, finalInit);
  } finally {
    clearTimeout(tm);
  }
}
