"use client";
import { useEffect } from "react";
import { isHorizontalDrag, isVerticalDrag } from "@/utils/media-bridge";
import { useNextPrev } from "@/hooks/useNextPrev";

export function useGestures(){
  const { next, prev } = useNextPrev();
  useEffect(()=>{
    let sx=0, sy=0;
    const onStart = (e: TouchEvent) => {
      const t = e.touches?.[0]; if (!t) return; sx=t.clientX; sy=t.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches?.[0]; if (!t) return;
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (isHorizontalDrag(dx,dy)) { (dx<0? next(): prev()); }
      else if (isVerticalDrag(dx,dy)) {
        // مساحة لتبديل وضع العرض/الرسائل إن لزم لاحقًا
        window.dispatchEvent(new CustomEvent("ui:toggle-mode"));
      }
    };
    window.addEventListener("touchstart", onStart, { passive:true });
    window.addEventListener("touchend", onEnd, { passive:true });
    return ()=> {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [next, prev]);
}