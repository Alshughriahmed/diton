"use client";
import { useEffect, useState } from "react";

type PeerMeta = {
  country?: string | null;
  city?: string | null;
  gender?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  likes?: number | null;
};

export default function usePeerMeta() {
  const [m, setM] = useState<PeerMeta | null>(null);
  useEffect(() => {
    const KEY = "ditona:peer:meta";
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(KEY);
        if (raw) {
          try { setM(JSON.parse(raw)); } catch {}
        }
        const onMeta = (e: any) => { try { setM(e?.detail ?? null); } catch {} };
        window.addEventListener("ditona:peer-meta", onMeta as any);
        return () => window.removeEventListener("ditona:peer-meta", onMeta as any);
      }
    } catch {}
  }, []);
  return m;
}
