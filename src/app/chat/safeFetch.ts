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

// ==== RTC wiring helpers (non-breaking; flags OFF) ====
// Builds RTC headers for idempotency and ICE grace without forcing call sites to change yet.
export type RtcMeta = { pairId?: string; role?: string; sdpTag?: string; anonId?: string; lastStopTs?: number };
export function rtcHeaders(meta: RtcMeta = {}): Record<string,string> {
  const h: Record<string,string> = {};
  if (meta.pairId) h["x-pair-id"] = String(meta.pairId);
  if (meta.role) h["x-rtc-role"] = String(meta.role);
  if (meta.sdpTag) h["x-sdp-tag"] = String(meta.sdpTag);
  // best-effort anon + lastStopTs from client storage
  try {
    if (!meta.anonId && typeof localStorage!=="undefined") meta.anonId = localStorage.getItem("__anonId") || "";
    if (meta.anonId) h["x-anon-id"] = meta.anonId;
    if (!meta.lastStopTs && typeof localStorage!=="undefined") {
      const v = Number(localStorage.getItem("__lastStopTs") || "0");
      if (v>0) meta.lastStopTs = v;
    }
    if (meta.lastStopTs) h["x-last-stop-ts"] = String(meta.lastStopTs);
  } catch {}
  return h;
}

// create/update anon id if absent; no server roundtrip needed
export function ensureAnonId(): string {
  let id = "";
  try {
    if (typeof localStorage!=="undefined") {
      id = localStorage.getItem("__anonId") || "";
      if (!id) { id = (globalThis.crypto?.randomUUID?.() ?? String(Date.now())); localStorage.setItem("__anonId", id); }
    }
  } catch {}
  return id;
}

export function markLastStopTs(ts?: number){
  try { if (typeof localStorage!=="undefined") localStorage.setItem("__lastStopTs", String(ts ?? Date.now())); } catch {}
}
