// src/app/chat/rtcFlow.ts
// Minimal RTC flow per k.md: init → enqueue → matchmake, re-enqueue on 400

"use client";

import apiSafeFetch from "./safeFetch";
import { setAnonId } from "./anonState";

type Role = "caller" | "callee";
type SetPhase = (phase: string, payload?: any) => void;

export const RTC_FLOW_VERSION = "S1.4";

// ---- helpers ----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function markLastStopTs() { try { localStorage.setItem("ditona:lastStopTs", String(Date.now())); } catch {} }
function rtcHeaders() {
  const h: Record<string, string> = {};
  try {
    const ts = localStorage.getItem("ditona:lastStopTs");
    if (ts) h["x-last-stop-ts"] = ts;
  } catch {}
  return h;
}

// ---- steps ----
async function initAnon() {
  // يثبّت الكوكي الموقّع ويعيد {anonId}
  const r = await apiSafeFetch("/api/rtc/init", { method: "GET", timeoutMs: 6000 }).catch(() => undefined);
  if (r?.ok) {
    try {
      const j = await r.json();
      if (j?.anonId) setAnonId(String(j.anonId));
    } catch {}
  }
}

async function ensureEnqueue() {
  // أقل مدخلات لازمة؛ التطبيع يتم على السيرفر
  await apiSafeFetch("/api/rtc/enqueue", {
    method: "POST",
    headers: { "content-type": "application/json", ...rtcHeaders() },
    body: JSON.stringify({
      gender: "u",
      country: "XX",
      filterGenders: "all",
      filterCountries: "ALL",
    }),
    timeoutMs: 6000,
  }).catch(() => undefined);
}

async function pollMatchmake(signal: AbortSignal) {
  let back = 350;
  for (;;) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");

    const res = await apiSafeFetch("/api/rtc/matchmake", {
      method: "GET",
      headers: rtcHeaders(),
      timeoutMs: 6000,
    }).catch(() => undefined);

    if (res?.status === 200) {
      try {
        const j = await res.json();
        if (j?.pairId && j?.role) {
          return j as { pairId: string; role: Role; peerAnonId?: string };
        }
      } catch {}
    }

    // 400 = attrs-missing الحقيقي → أعد enqueue ثم تابع البولنغ
    if (res?.status === 400) {
      await ensureEnqueue();
    }

    await sleep(back + Math.floor(Math.random() * 150));
    back = Math.min(back * 1.3, 1400);
  }
}

// ---- public API ----
/** الواجهة المتوقعة: start/next/prev/stop */
export async function start(
  arg1?: AbortController | MediaStream,   // متوافق مع الواجهة القديمة
  setPhase?: SetPhase,                    // يُمرَّر من ChatClient.tsx
  arg3?: AbortController
) {
  const aborter =
    arg1 instanceof AbortController ? arg1 :
    arg3 instanceof AbortController ? arg3 :
    undefined;

  const ac = aborter ?? new AbortController();

  console.info("RTC_FLOW_VERSION=%s", RTC_FLOW_VERSION);
  await initAnon();
  if (typeof setPhase === "function") setPhase("searching");
  await ensureEnqueue();
  const m = await pollMatchmake(ac.signal);
  if (typeof setPhase === "function") setPhase("matched", { pairId: m.pairId, role: m.role });
  return m;
}
export const startRTCFlow = start;

/** next/prev تعيد تشغيل البحث بنفس الآلية (teardown خارجيًا). */
export async function next(...args: any[]) { return await start(...args as [any]); }
export async function prev(...args: any[]) { return await start(...args as [any]); }

/** stop يسجّل x-last-stop-ts لدعم ICE-Grace على السيرفر. */
export function stop() { markLastStopTs(); }
