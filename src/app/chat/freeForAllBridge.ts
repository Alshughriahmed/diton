// use client
/**
 * Bridge window <-> internal event bus with loop-guard
 * Also bootstraps FFA runtime once.
 */
import { on, emit } from "@/utils/events";

declare global {
  interface Window {
    __ditonaBridgeInit?: 1;
    __ditonaFFALoaded?: 1;
    __DITONA_FFA?: 0|1;
  }
}

if (!window.__ditonaBridgeInit) {
  window.__ditonaBridgeInit = 1;

  // --- FFA bootstrap (runtime) ---
  (async () => {
    if (!window.__ditonaFFALoaded) {
      try {
        const r = await fetch("/api/rtc/env", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        const ffa = (j?.server?.FREE_FOR_ALL === "1") || (j?.public?.NEXT_PUBLIC_FREE_FOR_ALL === "1");
        window.__DITONA_FFA = ffa ? 1 : 0;
        window.__ditonaFFALoaded = 1;
        window.dispatchEvent(new CustomEvent("ffa:ready", { detail: { ffa: window.__DITONA_FFA } }));
      } catch {}
    }
  })();

  // --- Event bridge with bounce guard ---
  const FLAG = "__bridge";
  const names = ["rtc:phase", "rtc:pair", "ditona:peer-meta"] as const;

  // window -> bus
  for (const n of names) {
    window.addEventListener(n, (ev: any) => {
      const d = ev?.detail || {};
      if (d && d[FLAG]) return; // already bridged
      try { emit(n as any, { ...d, [FLAG]:"win" }); } catch {}
    }, { passive: true });
  }

  // bus -> window
  for (const n of names) {
    on(n as any, (d: any) => {
      if (d && d[FLAG]) return; // avoid echo
      try { window.dispatchEvent(new CustomEvent(n, { detail: { ...d, [FLAG]:"bus" } })); } catch {}
    });
  }
}