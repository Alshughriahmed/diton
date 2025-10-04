// rtcHeaders.client.ts — M2 helpers (no wiring here)
"use client";

// تخزين آخر توقيت Stop
let __lastStopTsMem = 0;

export function markLastStopTs(ts?: number) {
  const v = ts ?? Date.now();
  __lastStopTsMem = v;
  try { if (typeof localStorage !== "undefined") localStorage.setItem("__lastStopTs", String(v)); } catch {}
}

export function getLastStopTs(): number {
  try {
    if (typeof localStorage !== "undefined") {
      const s = localStorage.getItem("__lastStopTs");
      if (s) return Number(s) || 0;
    }
  } catch {}
  return __lastStopTsMem || 0;
}

// توليد رؤوس RTC موحّدة
export type RtcMeta = {
  pairId?: string;
  role?: "caller" | "callee" | string;
  anonId?: string;
  sdpTag?: string;
  idempotencyKey?: string; // لطلبات POST offer/answer فقط
  lastStopTs?: number;
};

export function rtcHeaders(meta: RtcMeta = {}): Record<string, string> {
  const h: Record<string, string> = {};
  if (meta.pairId) h["x-pair-id"] = String(meta.pairId);
  if (meta.role) h["x-rtc-role"] = String(meta.role);
  if (meta.sdpTag) h["x-sdp-tag"] = String(meta.sdpTag);
  if (meta.idempotencyKey) h["x-idempotency-key"] = String(meta.idempotencyKey);

  // anonId من localStorage إن لم يُمرّر
  try {
    if (!meta.anonId && typeof localStorage !== "undefined") {
      const v = localStorage.getItem("__anonId") || "";
      if (v) meta.anonId = v;
    }
  } catch {}
  if (meta.anonId) h["x-anon-id"] = meta.anonId;

  // last-stop للـ ICE grace
  const last = meta.lastStopTs ?? getLastStopTs();
  if (last) h["x-last-stop-ts"] = String(last);

  return h;
}
