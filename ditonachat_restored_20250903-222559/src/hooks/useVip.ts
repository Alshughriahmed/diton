"use client";
import { useEffect, useState } from "react";
type Me = { isVip?: boolean; freeAll?: boolean; subscription?: { status?: string | null } | null };
export function useVip() {
  const [isVip, setIsVip] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me").catch(() => null);
        const j: Me | null = r && r.ok ? await r.json() : null;
        const vip = !!(j?.isVip || j?.freeAll || j?.subscription?.status === "active");
        if (!cancelled) setIsVip(vip);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);
  return { isVip };
}
