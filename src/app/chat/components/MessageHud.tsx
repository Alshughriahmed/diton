// src/app/chat/components/MessageHud.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Line = { text: string; ts: number; dir: "out" | "in" };

const MIN_VISIBLE = 3;

export default function MessageHud() {
  const containerRef = useRef<HTMLDivElement>(null);

  // pair context
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);

  // per-pair full history kept off-UI
  const historyRef = useRef<Map<string, Line[]>>(new Map());

  // visible window
  const [visible, setVisible] = useState<Line[]>([]);
  const [showCount, setShowCount] = useState<number>(MIN_VISIBLE);

  // autoscroll to bottom of visible
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [visible]);

  /* ========== helpers ========== */
  const setFromHistory = (pid: string | null, count = showCount) => {
    if (!pid) { setVisible([]); return; }
    const hist = historyRef.current.get(pid) || [];
    const n = Math.max(MIN_VISIBLE, Math.min(count, hist.length || MIN_VISIBLE));
    setVisible(hist.slice(-n));
  };

  const pushToHistory = (pid: string, l: Line) => {
    const hist = historyRef.current.get(pid) || [];
    hist.push(l);
    historyRef.current.set(pid, hist);
    setFromHistory(pid); // keep last N on screen
  };

  const clearHistory = (pid?: string | null) => {
    if (pid) historyRef.current.delete(pid);
    setShowCount(MIN_VISIBLE);
    setVisible([]);
  };

  /* ========== pair switch / resets ========== */
  useEffect(() => {
    const onPair = (e: any) => {
      const pid = e?.detail?.pairId || e?.pairId || null;
      setCurrentPairId(pid);
      setShowCount(MIN_VISIBLE);
      // start a fresh history bucket for the new pair
      if (pid) historyRef.current.set(pid, []);
      setFromHistory(pid, MIN_VISIBLE);
    };
    const onReset = (e: any) => {
      const pid = e?.detail?.pairId ?? currentPairId ?? null;
      clearHistory(pid);
      if (pid) historyRef.current.set(pid, []);
    };
    window.addEventListener("rtc:pair", onPair as any);
    window.addEventListener("ui:msg:reset", onReset as any);
    return () => {
      window.removeEventListener("rtc:pair", onPair as any);
      window.removeEventListener("ui:msg:reset", onReset as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPairId]);

  /* ========== in/out messages with ghost guard ========== */
  useEffect(() => {
    const add = (dir: "out" | "in") => (e: any) => {
      const msg = e?.detail ?? {};
      if (typeof msg.text !== "string") return;
      const pid: string | null =
        typeof msg.pairId === "string" && msg.pairId ? msg.pairId : currentPairId;
      if (!pid || (currentPairId && pid !== currentPairId)) return; // block ghosts
      pushToHistory(pid, { text: msg.text, ts: Date.now(), dir });
    };
    const sent = add("out");
    const recv = add("in");
    window.addEventListener("ditona:chat:sent", sent as any);
    window.addEventListener("ditona:chat:recv", recv as any);
    return () => {
      window.removeEventListener("ditona:chat:sent", sent as any);
      window.removeEventListener("ditona:chat:recv", recv as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPairId]);

  /* ========== vertical swipe to reveal older messages ========== */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startY = 0;
    let baseCount = MIN_VISIBLE;
    let dragging = false;

    const maxForPair = () => {
      if (!currentPairId) return MIN_VISIBLE;
      return (historyRef.current.get(currentPairId) || []).length || MIN_VISIBLE;
    };

    const onDown = (ev: PointerEvent | TouchEvent) => {
      const y =
        (ev as PointerEvent).clientY ??
        (ev as TouchEvent).touches?.[0]?.clientY ??
        0;
      startY = y;
      baseCount = showCount;
      dragging = true;
    };
    const onMove = (ev: PointerEvent | TouchEvent) => {
      if (!dragging) return;
      const y =
        (ev as PointerEvent).clientY ??
        (ev as TouchEvent).touches?.[0]?.clientY ??
        0;
      const dy = startY - y; // swipe up => positive
      // each ~24px reveals one more message; down hides
      const delta = Math.trunc(dy / 24);
      const wanted = Math.max(MIN_VISIBLE, Math.min(maxForPair(), baseCount + delta));
      if (wanted !== showCount) {
        setShowCount(wanted);
        setFromHistory(currentPairId, wanted);
      }
    };
    const onUp = () => { dragging = false; };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    // touch support
    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove as any, { passive: true });
    el.addEventListener("touchend", onUp, { passive: true });
    el.addEventListener("touchcancel", onUp, { passive: true });

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("touchstart", onDown as any);
      el.removeEventListener("touchmove", onMove as any);
      el.removeEventListener("touchend", onUp as any);
      el.removeEventListener("touchcancel", onUp as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPairId, showCount]);

  if (visible.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-x-2 sm:inset-x-4 bottom-20 sm:bottom-24 z-[55] space-y-1 select-none"
    >
      {visible.map((l, i) => (
        <div
          key={i}
          onPointerDown={(e) => {
            e.preventDefault();
            try { navigator.clipboard?.writeText(l.text); } catch {}
          }}
          className="pointer-events-auto cursor-copy select-text text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-sm"
        >
          <span className={l.dir === "in" ? "text-white/80" : "text-emerald-300"}>
            {l.dir === "in" ? "• " : "▲ "}
          </span>
          {l.text}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
