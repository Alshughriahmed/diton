// src/lib/vibrate.ts  // NEW
export function vibrate(ms = 30) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) (navigator as any).vibrate(ms);
  } catch {}
}
