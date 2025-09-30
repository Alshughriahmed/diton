"use client";
import { useEffect, useState } from "react";
import safeFetch from '@/app/chat/safeFetch';
type Mode = "memory" | "redis" | null;
export function useQueueLen(intervalMs: number = 5000) {
  const [len, setLen] = useState(0);
  const [mode, setMode] = useState<Mode>(null);
  useEffect(() => {
    let stop = false;
    const tick = () =>
      safeFetch("/api/rtc/qlen")
        .then((r) => r.json())
        .then((j) => {
          if (stop) return;
          setLen(Number(j?.len || 0));
          setMode((j?.mode as Mode) || null);
        })
        .catch(() => {});
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [intervalMs]);
  return { len, mode };
}
