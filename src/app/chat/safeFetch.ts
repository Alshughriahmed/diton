export default async function safeFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const reqId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const headers = new Headers(init.headers || {});
  if (!headers.has("x-req-id")) headers.set("x-req-id", reqId);
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return fetch(input, { ...init, credentials: "include", cache: "no-store", headers });
}
