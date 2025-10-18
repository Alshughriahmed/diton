"use client";
import { useEffect, useState, useRef } from "react";
import { emit } from "@/utils/events";

type Line = { text: string; ts: number; dir: "out" | "in" };

export default function MessageHud() {
  const [lines, setLines] = useState<Line[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines]);

  // current pair context + reset on new pair
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);
  useEffect(() => {
    function onPair(event: any) {
      const pairId = event?.detail?.pairId || event?.pairId || null;
      setCurrentPairId(pairId);
      setLines([]);
      if (pairId) emit("ui:msg:reset" as any, { pairId });
    }
    window.addEventListener("rtc:pair", onPair as any);
    return () => window.removeEventListener("rtc:pair", onPair as any);
  }, []);

  // strict chat schema + ghost guard
  useEffect(() => {
    const add = (dir: "out" | "in") => (e: CustomEvent) => {
      const msg: any = (e && (e as any).detail) || {};
      if (typeof msg.text !== "string") return;
      const messagePairId = msg.pairId ?? null;
      if (currentPairId && messagePairId !== currentPairId) return; // block ghosts
      setLines((l) => [...l, { text: msg.text, ts: Date.now(), dir }].slice(-3));
    };
    const sent = add("out");
    const recv = add("in");
    window.addEventListener("ditona:chat:sent", sent as any);
    window.addEventListener("ditona:chat:recv", recv as any);
    return () => {
      window.removeEventListener("ditona:chat:sent", sent as any);
      window.removeEventListener("ditona:chat:recv", recv as any);
    };
  }, [currentPairId]);

  if (lines.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-2 sm:inset-x-4 bottom-20 sm:bottom-24 z-[55] space-y-1">
      {lines.map((l, i) => (
        <div
          key={i}
          onPointerDown={(e) => {
            e.preventDefault();
            navigator.clipboard?.writeText(l.text).catch(() => {});
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
