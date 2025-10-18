"use client";
import { useEffect, useRef, useState } from "react";

type Line = { text: string; ts: number; dir: "out" | "in"; pairId: string };

export function MessageHud() {
  const [history, setHistory] = useState<Line[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const curPairRef = useRef<string>("");

  // reset عند بدء زوج جديد
  useEffect(() => {
    const onPair = (e: any) => {
      const pid = e?.detail?.pairId || e?.pairId || "";
      curPairRef.current = String(pid || "");
      setHistory([]);
      setVisibleCount(3);
    };
    window.addEventListener("rtc:pair", onPair as any);
    return () => window.removeEventListener("rtc:pair", onPair as any);
  }, []);

  // استقبال
  useEffect(() => {
    const onRecv = (e: any) => {
      const d = e?.detail as { text: string; pairId?: string; ts?: number };
      const cur = curPairRef.current || (window as any).__ditonaPairId || (window as any).__pairId || "";
      if (d?.pairId && d.pairId !== cur) return; // drop ghosts
      if (typeof d?.text !== "string" || !d.text.trim()) return;
      setHistory((h) => [...h, { text: d.text, ts: d.ts || Date.now(), dir: "in", pairId: cur }]);
    };
    window.addEventListener("ditona:chat:recv", onRecv as any);
    return () => window.removeEventListener("ditona:chat:recv", onRecv as any);
  }, []);

  // بعد الإرسال المحلي نضيف نسخة “out”
  useEffect(() => {
    const onSent = (e: any) => {
      const d = e?.detail as { text: string; pairId?: string; ts?: number };
      const cur = curPairRef.current || (window as any).__ditonaPairId || (window as any).__pairId || "";
      if (d?.pairId && d.pairId !== cur) return;
      if (typeof d?.text !== "string" || !d.text.trim()) return;
      setHistory((h) => [...h, { text: d.text, ts: d.ts || Date.now(), dir: "out", pairId: cur }]);
    };
    window.addEventListener("ditona:chat:sent", onSent as any);
    return () => window.removeEventListener("ditona:chat:sent", onSent as any);
  }, []);

  // سحب/تمرير لزيادة عدد الظاهر
  useEffect(() => {
    let startY = 0;
    let moved = false;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) setVisibleCount((n) => Math.min(history.length, n + 1));
    };
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0]?.clientY ?? 0; moved = false; };
    const onTouchMove = (e: TouchEvent) => {
      const dy = (e.touches[0]?.clientY ?? 0) - startY;
      if (dy > 30 && !moved) { moved = true; setVisibleCount((n) => Math.min(history.length, n + 1)); }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [history.length]);

  // آخر N فقط
  const lines = history.slice(-visibleCount);
  if (lines.length === 0) return null;

  // نسخ بالضغط المطوّل + إعادة إرسال للمرسل فقط
  const onHold = (l: Line) => {
    let t: any;
    const start = () => {
      t = setTimeout(() => {
        try { navigator.clipboard?.writeText(l.text); } catch {}
        if (l.dir === "out") {
          try { window.dispatchEvent(new CustomEvent("ditona:chat:send", { detail: { text: l.text } })); } catch {}
        }
      }, 350);
    };
    const cancel = () => clearTimeout(t);
    return { onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel };
  };

  return (
    <div className="pointer-events-none absolute inset-x-2 sm:inset-x-4 bottom-20 sm:bottom-24 z-[55] space-y-1">
      {lines.map((l, i) => (
        <div
          key={i}
          {...onHold(l)}
          className="pointer-events-auto cursor-copy select-text text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-sm"
        >
          <span className={l.dir === "in" ? "text-white/80" : "text-emerald-300"}>
            {l.dir === "in" ? "• " : "▲ "}
          </span>
          {l.text}
        </div>
      ))}
    </div>
  );
}

export default MessageHud;
