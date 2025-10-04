export type SafeInit = RequestInit & { timeoutMs?: number; xReqId?: string };

function rid() {
  try {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a).map(x=>x.toString(16).padStart(2,"0")).join("");
  } catch { return String(Date.now()); }
}

export default async function safeFetch(input: RequestInfo | URL, init: SafeInit = {}) {
  const { timeoutMs, xReqId, headers, ...rest } = init;

  const h = new Headers(headers ?? {});
  if (!h.has("x-req-id")) h.set("x-req-id", xReqId || rid());
  if (!h.has("cache-control")) h.set("cache-control","no-store");

  const controller = new AbortController();
  let t: any = null;
  if (timeoutMs && timeoutMs > 0) t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...rest,
      headers: h,
      signal: controller.signal,
      credentials: rest.credentials ?? "include",
      cache: rest.cache ?? "no-store",
    });
  } finally {
    if (t) clearTimeout(t);
  }
}
