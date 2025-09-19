"use client";
let cached: 0|1|null = null;
export function isFFA(): boolean {
  if (typeof window === "undefined") return false;
  if (cached === null) {
    const w = window as any;
    const ls = (typeof localStorage !== "undefined" && localStorage.getItem("ditona_ffa")) || null;
    const v = (w as any).__DITONA_FFA ?? (ls === "1" ? 1 : 0);
    cached = v === 1 ? 1 : 0;
  }
  return cached === 1;
}
export async function loadFFA(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/rtc/env", { cache: "no-store" });
    const j = await res.json();
    const on = j?.server?.FREE_FOR_ALL === "1" || j?.public?.NEXT_PUBLIC_FREE_FOR_ALL === "1";
    (window as any).__DITONA_FFA = on ? 1 : 0;
    try { localStorage.setItem("ditona_ffa", on ? "1" : "0"); } catch {}
    cached = on ? 1 : 0;
    window.dispatchEvent(new CustomEvent("ditona:ffa", { detail: { on } }));
  } catch {}
}
