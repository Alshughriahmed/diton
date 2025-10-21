"use client";

import { useEffect } from "react";
import { emit } from "@/utils/events";

const THRESHOLD = 48;         // بيكسل أفقية لازمة
const MAX_ANGLE = 25;         // درجة ميلان عن الأفق
const COOLDOWN_MS = 300;

export function useGestures() {
  useEffect(() => {
    let startX = 0, startY = 0, active = false, fired = false;
    let lastFire = 0;

    const start = (x: number, y: number) => { active = true; fired = false; startX = x; startY = y; };
    const move  = (x: number, y: number) => {
      if (!active || fired) return;
      const dx = x - startX, dy = y - startY;
      const absx = Math.abs(dx), absy = Math.abs(dy);
      if (absx < THRESHOLD) return;
      // تجاهل السحب العمودي
      const angle = Math.atan2(absy, absx) * 180 / Math.PI;
      if (angle > MAX_ANGLE) return;

      const now = Date.now();
      if (now - lastFire < COOLDOWN_MS) return;

      fired = true; lastFire = now;
      if (dx < 0) emit("ui:next"); else emit("ui:prev");
    };
    const end = () => { active = false; };

    // لمس
    const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; if (t) start(t.clientX, t.clientY); };
    const onTouchMove  = (e: TouchEvent) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); };
    const onTouchEnd   = () => end();

    // ماوس للسحب على الديسكتوب
    let mouseDown = false;
    const onMouseDown = (e: MouseEvent) => { mouseDown = true; start(e.clientX, e.clientY); };
    const onMouseMove = (e: MouseEvent) => { if (mouseDown) move(e.clientX, e.clientY); };
    const onMouseUp   = () => { mouseDown = false; end(); };

    // اربط على window ليعمل فوق أي طبقة
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove",  onTouchMove,  { passive: true });
    window.addEventListener("touchend",   onTouchEnd,   { passive: true });
    window.addEventListener("mousedown",  onMouseDown);
    window.addEventListener("mousemove",  onMouseMove);
    window.addEventListener("mouseup",    onMouseUp);

    return () => {
      window.removeEventListener("touchstart", onTouchStart as any);
      window.removeEventListener("touchmove",  onTouchMove as any);
      window.removeEventListener("touchend",   onTouchEnd as any);
      window.removeEventListener("mousedown",  onMouseDown as any);
      window.removeEventListener("mousemove",  onMouseMove as any);
      window.removeEventListener("mouseup",    onMouseUp as any);
    };
  }, []);
}
export default useGestures;
