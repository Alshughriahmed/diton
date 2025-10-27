"use client";

import { useState, useEffect, useRef } from "react";
import { emit, on } from "@/utils/events";
import safeFetch from "@/app/chat/safeFetch";
import { likeApiThenDc } from "@/app/chat/likeSyncClient";

type LikeState = {
  myLikes: number;
  peerLikes: number;
  isLiked: boolean;
  canLike: boolean;
};

export default function LikeSystem() {
  const [st, setSt] = useState<LikeState>({ myLikes: 0, peerLikes: 0, isLiked: false, canLike: true });
  const pairRef = useRef<string | null>(null);
  const connectedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollOnce = async () => {
    const pid = pairRef.current;
    if (!connectedRef.current || !pid) return;
    try {
      const r = await safeFetch(`/api/like?pairId=${encodeURIComponent(pid)}`, { method: "GET" });
      if (r.ok) {
        const j = await r.json();
        setSt((p) => ({ ...p, peerLikes: j.count || 0, isLiked: !!(j.mine ?? j.you), canLike: true }));
      }
    } catch {}
  };

  const startPolling = () => {
    stopPolling();
    pollOnce();
    pollRef.current = setInterval(pollOnce, 2000);
  };
  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // pair + phase wiring
  useEffect(() => {
    const offPair = on("rtc:pair" as any, (d) => {
      pairRef.current = d?.pairId || null;
      setSt({ myLikes: 0, peerLikes: 0, isLiked: false, canLike: true });
      if (connectedRef.current && pairRef.current) startPolling();
    });

    const offPhase = on("rtc:phase" as any, (d) => {
      const ph = d?.phase;
      connectedRef.current = ph === "connected";
      if (!connectedRef.current) {
        stopPolling();
        setSt({ myLikes: 0, peerLikes: 0, isLiked: false, canLike: true });
      } else if (pairRef.current) {
        startPolling();
      }
    });

    // back-compat external updates
    const offUiUpd = on("ui:likeUpdate", (data) => data && setSt((p) => ({ ...p, ...data })));

    // DC closed → نعتمد على polling فقط
    const onDcClosed = () => connectedRef.current && pairRef.current && startPolling();
    window.addEventListener("ditona:datachannel-closed", onDcClosed);

    return () => {
      offPair?.(); offPhase?.(); offUiUpd?.(); stopPolling();
      window.removeEventListener("ditona:datachannel-closed", onDcClosed);
    };
  }, []);

  // public action via custom event from شريط الأدوات
  useEffect(() => {
    const onTap = async (e: any) => {
      const pid = pairRef.current;
      if (!pid || !st.canLike) return;

      const original = st;
      const nextIsLiked = !st.isLiked;

      // optimistic
      setSt((p) => ({
        ...p,
        isLiked: nextIsLiked,
        peerLikes: Math.max(0, p.peerLikes + (nextIsLiked ? 1 : -1)),
        canLike: false,
      }));

      try {
        const dc = (globalThis as any).__ditonaDataChannel;
        const res = await likeApiThenDc(pid, dc);
        if (!res || !res.ok) throw new Error("like failed");
        // sync from server
        await pollOnce();
        emit("ui:like", { isLiked: nextIsLiked, myLikes: st.myLikes, pairId: pid });
      } catch {
        // rollback
        setSt({ ...original, canLike: true });
      } finally {
        setSt((p) => ({ ...p, canLike: true }));
      }
    };

    window.addEventListener("ui:like:toggle", onTap as any);
    return () => window.removeEventListener("ui:like:toggle", onTap as any);
  }, [st]);

  // لا UI إطلاقًا
  return null;
}
