"use client";
import { useEffect, useState } from "react";
import safeFetch from '@/app/chat/safeFetch';

function readBuildTime(): boolean {
  try { return process.env.NEXT_PUBLIC_FREE_FOR_ALL === "1"; } catch { return false; }
}

export function useFFA(): boolean {
  const [ffa, setFFA] = useState<boolean>(readBuildTime());
  useEffect(() => {
    const probe = async () => {
      try {
        const r = await safeFetch("/api/rtc/env");
        const j = await r.json().catch(()=>({}));
        setFFA(j?.public?.NEXT_PUBLIC_FREE_FOR_ALL === "1");
      } catch {}
    };
    probe();
    const id = setInterval(probe, 15000);
    return () => clearInterval(id);
  }, []);
  return ffa;
}