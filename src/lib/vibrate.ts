// src/lib/vibrate.ts
export function vibrate(ms = 18) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate(ms);
    }
  } catch {}
}

export function vibrateNextPrev() {
  vibrate(18);
}
