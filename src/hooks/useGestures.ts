"use client";

import { useEffect } from "react";
import { isHorizontalDrag, isVerticalDrag } from "@/utils/media-bridge";
import { useNextPrev } from "@/hooks/useNextPrev";

function inModal(target: EventTarget | null): boolean {
  const sel = '[data-modal="gender"],[data-modal="country"]';
  return target instanceof Node && !!(target as Element).closest?.(sel);
}

function inMessages(target: EventTarget | null): boolean {
  const sel = '[data-ui="messages-overlay"],[data-ui="messages-fixed"]';
  return target instanceof Node && !!(target as Element).closest?.(sel);
}

export function useGestures() {
  const { next, prev } = useNextPrev();

  useEffect(() => {
    let sx = 0, sy = 0;

    const onStart = (e: TouchEvent) => {
      if (inModal(e.target) || inMessages(e.target)) return;
      const t = e.touches?.[0]; if (!t) return;
      sx = t.clientX; sy = t.clientY;
    };

    const onEnd = (e: TouchEvent) => {
      if (inModal(e.target) || inMessages(e.target)) return;
      const t = e.changedTouches?.[0]; if (!t) return;
      const dx = t.clientX - sx, dy = t.clientY - sy;

      if (isHorizontalDrag(dx, dy)) {
        dx < 0 ? next() : prev();
      } else if (isVerticalDrag(dx, dy)) {
        try { window.dispatchEvent(new CustomEvent("ui:toggle-mode")); } catch {}
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onStart as any);
      window.removeEventListener("touchend", onEnd as any);
    };
  }, [next, prev]);
}

export default useGestures;
