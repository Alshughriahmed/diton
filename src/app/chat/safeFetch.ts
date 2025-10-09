// src/app/chat/safeFetch.ts
// Hardening: x-req-id, no-store, include, keepalive, 8s timeout, no-throw.

export type ApiSafeResp<T = any> = {
  ok: boolean;
  status: number;
  headers: Headers;
  reqId: string;
  raw: Response | null;
  json: () => Promise<T | null>;
  text: () => Promise<string>;
  error?: unknown;
};

const uuidv4 = (): string => {
  try {
    const g: any = globalThis as any;
    if (g && g.crypto && typeof g.crypto.randomUUID === "function") {
      return g.crypto.randomUUID();
    }
  } catch {}
  // RFC4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

type InitExt = RequestInit & { timeoutMs?: number; reqId?: string };

export async function apiSafeFetch<T = any>(
  input: RequestInfo | URL,
  init: InitExt = {}
): Promise<ApiSafeResp<T>> {
  const timeoutMs = init.timeoutMs ?? 8000;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    try {
      controller.abort(new DOMException("timeout", "AbortError"));
    } catch {
      // no-op
    }
  }, timeoutMs);

  const headers = new Headers(init.headers || undefined);

  // Ensure x-req-id
  const reqId = init.reqId || headers.get("x-req-id") || uuidv4();
  headers.set("x-req-id", reqId);

  // Default Accept
  if (!headers.has("accept")) headers.set("accept", "application/json");

  // Do not force Content-Type unless body exists and not set
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const finalInit: RequestInit = {
    ...init,
    headers,
    // Network behavior hardening
    cache: "no-store",
    credentials: "include",
    keepalive: true as any,
    signal: controller.signal,
  };

  try {
    const res = await fetch(input, finalInit);
    clearTimeout(timer);
    const wrap: ApiSafeResp<T> = {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      reqId,
      raw: res,
      json: async () => {
        try {
          return (await res.json()) as T;
        } catch {
          return null;
        }
      },
      text: async () => {
        try {
          return await res.text();
        } catch {
          return "";
        }
      },
    };
    return wrap;
  } catch (error) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      reqId,
      raw: null,
      json: async () => null,
      text: async () => "",
      error,
    };
  }
}

export default apiSafeFetch;
