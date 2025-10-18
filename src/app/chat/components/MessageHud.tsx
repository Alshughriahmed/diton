"use client";
import { useEffect, useRef, useState } from "react";

type Line = { text: string; ts: number; dir: "out" | "in"; pairId: string };

export function MessageHud() {
  const [history, setHistory] = useState<Line[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const curPairRef = useRef<string>("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // reset عند بدء زوج جديد + عند طلب مسح صريح + عند التحول للبحث/التوقف
  useEffect(() => {
    const reset = (pid?: string) => {
      curPairRef.current = String(pid || curPairRef.current || "");
      setHistory([]);
      setVisibleCount(3);
    };
    const onPair = (e: any) => reset(e?.detail?.pairId || e?.pairId || "");
    const onReset = () => reset();
    const onPhase = (e: any) => {
      const p = e?.detail?.phase;
      if (p === "searching" || p === "stopped") reset();
    };

    window.addEventListener("rtc:pair", onPair as any);
    window.addEventListener("ui:msg:reset", onReset as any);
    window.addEventListener("rtc:phase", onPhase as any);
    return () => {
      window.removeEventListener("rtc:pair", onPair as any);
      window.removeEventListener("ui:msg:reset", onReset as any);
      window.removeEventListener("rtc:phase", onPhase as any);
    };
  }, []);

  // استقبال
  useEffect(() => {
    const onRecv = (e: any) => {
      const d = e?.detail as { text: string; pairId?: string; ts?: number };
      const cur = curPairRef.current || (window as any).__ditonaPairId || (window as any).__pairId || "";
      if (d?.pairId && d.pairId !== cur) return;
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

  // السحب/التمرير: اربط على window لكن فعّل فقط لو الهدف داخل HUD (لهاتف يعمل دائمًا)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    let startY = 0;
    let movedOnce = false;

    const isInside = (t: EventTarget | null) =>
      t instanceof Node && el.contains(t);

    const revealOlder = () => setVisibleCount((n) => Math.min(history.length, n + 1));
    const hideNewer = () => setVisibleCount((n) => Math.max(1, n - 1));

    const onWheel = (e: WheelEvent) => {
      if (!isInside(e.target)) return;
      if (e.deltaY < 0) revealOlder();
      else if (e.deltaY > 0) hideNewer();
      e.stopPropagation();
      e.preventDefault();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!isInside(e.target)) return;
      const t = e.touches[0]; if (!t) return;
      startY = t.clientY;
      movedOnce = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isInside(e.target)) return;
      const t = e.touches[0]; if (!t) return;
      const dy = t.clientY - startY;
      if (Math.abs(dy) > 30 && !movedOnce) {
        movedOnce = true;
        if (dy > 0) revealOlder(); else hideNewer();
      }
      e.stopPropagation();
      e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel as any);
      window.removeEventListener("touchstart", onTouchStart as any);
      window.removeEventListener("touchmove", onTouchMove as any);
    };
  }, [history.length]);

  const lines = history.slice(-visibleCount);
  if (lines.length === 0) return null;

  // نسخ بالضغط المطوّل + إعادة إرسال لرسائل المرسل فقط
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
    <div
      ref={wrapRef}
      data-ui="messages-overlay"
      className="pointer-events-auto absolute inset-x-2 sm:inset-x-4 bottom-20 sm:bottom-24 z-[55] space-y-1 select-none"
      style={{ WebkitTapHighlightColor: "transparent", touchAction: "none", overscrollBehavior: "contain" as any }}
    >
      {lines.map((l, i) => (
        <div
          key={i}
          {...onHold(l)}
          className="cursor-copy select-text text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-sm bg-transparent"
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
