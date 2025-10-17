"use client";
import { useEffect, useState } from "react";
import safeFetch from "@/app/chat/safeFetch";

const LAUNCH_OPEN = true; // الإطلاق التجريبي

function readBuildTime(): boolean {
  try { return process.env.NEXT_PUBLIC_FREE_FOR_ALL === "1"; } catch { return false; }
}
function readLocal(): boolean {
  try { return localStorage.getItem("FFA_FORCE") === "1"; } catch { return false; }
}

export function useFFA(): boolean {
  const [ffa, setFFA] = useState<boolean>(LAUNCH_OPEN || readBuildTime() || readLocal());
  useEffect(() => {
    const probe = async () => {
      try {
        const r = await safeFetch("/api/rtc/env");
        const j = await r.json().catch(()=>({}));
        const server = j?.public?.NEXT_PUBLIC_FREE_FOR_ALL === "1";
        setFFA(Boolean(LAUNCH_OPEN || server || readLocal()));
      } catch {
        setFFA(Boolean(LAUNCH_OPEN || readLocal()));
      }
    };
    probe();
    const id = setInterval(probe, 15000);
    return () => clearInterval(id);
  }, []);
  return ffa;
}
