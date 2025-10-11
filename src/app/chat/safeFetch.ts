// src/app/chat/safeFetch.ts
export type SafeOpts = RequestInit & { timeoutMs?: number };

function rid() {
  try {
    const a = new Uint32Array(3);
    crypto.getRandomValues(a);
    return Array.from(a, x => x.toString(36)).join("-");
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export default async function apiSafeFetch(input: string, opts: SafeOpts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(
    () => ctrl.abort(new DOMException("timeout", "AbortError")),
    opts.timeoutMs ?? 10000
  );

  const headers = new Headers(opts.headers || {});
  headers.set("x-req-id", rid());
  headers.set("accept", "application/json, text/plain, */*");

  // أضف anonId إن وُجد
  try {
    const anon =
      localStorage.getItem("anonId") || localStorage.getItem("ditona_anon");
    if (anon) headers.set("x-anon-id", anon);
  } catch {}

  const init: RequestInit = {
    ...opts,
    headers,
    credentials: opts.credentials ?? "include",
    cache: "no-store",
    signal: ctrl.signal,
  };

  try {
    const res = await fetch(input, init);
    return res;
  } catch (e) {
    // لا نرمي أخطاء الشبكة كي لا نكسر الـ flow الأعلى
    if ((e as any)?.name !== "AbortError") {
      console.warn("safeFetch network error:", e);
    }
    return undefined as any;
  } finally {
    clearTimeout(t);
  }
}
