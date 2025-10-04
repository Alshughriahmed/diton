export default async function safeFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("x-req-id")) {
    const r = Math.random().toString(36).slice(2) + Date.now().toString(36);
    headers.set("x-req-id", r);
  }
  if (process.env.NODE_ENV !== "production") {
    headers.set("x-anon-id", "dev-only");
  }
  return fetch(input, { ...init, headers, credentials: "include", cache: "no-store" });
}
