"use client";
/**
 * Listens to RTCDataChannel messages and:
 *  - replies to {type:'meta:init'} with {type:'meta', payload:{...}}
 *  - forwards incoming {type:'meta'} to window 'ditona:peer-meta'
 */

type AnyMsg = { type?: string; [k: string]: any };

function getLocalMeta() {
  // Country from localStorage ditona_geo if available
  let country: string | undefined, city: string | undefined, gender: string | undefined;
  try {
    const j = JSON.parse(localStorage.getItem("ditona_geo") || "null");
    country = j?.country || undefined;
    city = j?.city || undefined;
  } catch {}
  // Gender heuristic: try persisted selection
  try {
    const g = localStorage.getItem("ditona_gender") || localStorage.getItem("gender") || "";
    gender = g || undefined;
  } catch {}
  return { country, city, gender };
}

function wireDC(dc: RTCDataChannel) {
  if (!dc) return;
  try {
    dc.removeEventListener("message", onMsg as any);
    // no-op if not present
  } catch {}
  dc.addEventListener("message", onMsg as any, { passive: true });
  if (dc.readyState === "open") {
    try { dc.send(JSON.stringify({ type: "meta:init" })); } catch {}
    setTimeout(() => { try { dc.send(JSON.stringify({ type: "meta:init" })); } catch {} }, 300);
  }
}

function onMsg(ev: MessageEvent) {
  let d: AnyMsg = {};
  try { d = JSON.parse(String(ev.data || "")); } catch { /* ignore non-JSON */ }
  if (!d || !d.type) return;

  if (d.type === "meta:init") {
    const payload = getLocalMeta();
    try { (ev.target as RTCDataChannel)?.send(JSON.stringify({ type: "meta", payload })); } catch {}
    return;
  }
  if (d.type === "meta" && d.payload) {
    try { 
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: d.payload })); 
      }
    } catch {}
    return;
  }
}

(function init(){
  const w = typeof window !== "undefined" ? (window as any) : undefined;
  const dc = (w?.__ditonaDataChannel ?? w?.__ditonaDataChannel2) as RTCDataChannel | undefined;
  if (dc) wireDC(dc);

  // When phases change, try to (re)wire the latest DC reference
  if (typeof window !== "undefined") {
    window.addEventListener("rtc:phase", () => {
      const w = typeof window !== "undefined" ? (window as any) : undefined;
      const ndc = (w?.__ditonaDataChannel ?? w?.__ditonaDataChannel2) as RTCDataChannel | undefined;
      if (ndc) wireDC(ndc);
    });
  }
})();
