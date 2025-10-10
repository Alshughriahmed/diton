// Strict gating: init→enqueue→matchmake only with pinned anonId; PN/backoff/ICE grace remain as-is.
"use client";

import apiSafeFetch from "./safeFetch";
import { setAnonId } from "./anonState";

type Role = "caller" | "callee";

async function initAnon() {
  const r = await apiSafeFetch("/api/rtc/init", { method: "GET", timeoutMs: 6000 });
  if (r?.ok) {
    const j = await r.json().catch(() => ({}));
    if (j?.anonId) setAnonId(String(j.anonId));
  }
}

async function ensureEnqueue() {
  await apiSafeFetch("/api/rtc/enqueue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gender: "u", country: "XX", filterGenders: "all", filterCountries: "ALL" }),
    timeoutMs: 6000,
  });
}

async function pollMatchmake(signal: AbortSignal) {
  let back = 350;
  for (;;) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    const r = await apiSafeFetch("/api/rtc/matchmake", { method: "GET", timeoutMs: 6000 }).catch(() => undefined);
    if (r?.status === 200) {
      const j = await r.json().catch(() => ({}));
      if (j?.pairId && j?.role) return j as { pairId: string; role: Role };
    } else if (r?.status === 400) {
      await ensureEnqueue();
    }
    await new Promise(r => setTimeout(r, back + Math.floor(Math.random() * 150)));
    back = Math.min(back * 1.3, 1400);
  }
}

/* public entry used by your chat page */
export async function startRTCFlow(aborter: AbortController) {
  await initAnon();        // ← يثبّت anonId ويُخزّنه (x-anon-id سيُحقن تلقائيًا)
  await ensureEnqueue();   // ← كتابة attrs للـanon المثبّت
  return await pollMatchmake(aborter.signal);
}
