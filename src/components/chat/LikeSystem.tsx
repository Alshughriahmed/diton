"use client";

import { useState, useEffect, useRef } from "react";
import { emit, on } from "@/utils/events";
import safeFetch from "@/app/chat/safeFetch";
import { likeApiThenDc } from "@/app/chat/likeSyncClient";

type LikeData = {
  myLikes: number;
  peerLikes: number;
  isLiked: boolean;
  canLike: boolean;
};

export default function LikeSystem() {
  // منطق اللايكات فقط، بدون أي UI
  const [likeData, setLikeData] = useState<LikeData>({
    myLikes: 0,
    peerLikes: 0,
    isLiked: false,
    canLike: true,
  });

  const [phase, setPhase] = useState<string>("idle");
  const [pairId, setPairId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const readPairId = () => {
    try {
      return (
        (window as any).__ditonaPairId ||
        (window as any).__pairId ||
        null
      );
    } catch {
      return null;
    }
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const pollOnce = async (pid: string) => {
    try {
      const r = await safeFetch(`/api/like?pairId=${encodeURIComponent(pid)}`, { method: "GET" });
      if (!r.ok) return;
      const j = await r.json();
      setLikeData((prev) => ({
        ...prev,
        peerLikes: j.count || 0,
        isLiked: !!(j.you ?? j.mine),
        canLike: true,
      }));
    } catch {}
  };

  const startPolling = (pid: string) => {
    stopPolling();
    pollOnce(pid);
    pollingRef.current = setInterval(() => pollOnce(pid), 2000);
  };

  // تتبّع المرحلة والزوج الحالي
  useEffect(() => {
    const offPair = on("rtc:pair" as any, (d: any) => {
      const pid = d?.pairId || readPairId();
      setPairId(pid || null);
      setLikeData((s) => ({ ...s, peerLikes: 0, isLiked: false, canLike: true }));
      if (pid) startPolling(pid);
    });

    const offPhase = on("rtc:phase" as any, (d: any) => {
      const p = d?.phase || "idle";
      setPhase(p);
      if (p === "searching" || p === "matched" || p === "stopped" || p === "idle") {
        stopPolling();
        setPairId(null);
        setLikeData((s) => ({ ...s, peerLikes: 0, isLiked: false, canLike: true }));
      }
    });

    const onDcClosed = () => {
      // في حال انقطع الـDC نزيد الاعتماد على polling
      if (pairId) startPolling(pairId);
    };
    try {
      window.addEventListener("ditona:datachannel-closed", onDcClosed);
    } catch {}

    return () => {
      if (typeof offPair === "function") offPair();
      if (typeof offPhase === "function") offPhase();
      try { window.removeEventListener("ditona:datachannel-closed", onDcClosed); } catch {}
      stopPolling();
    };
  }, [pairId]);

  // استقبال طلبات الإرسال من شريط الأدوات
  useEffect(() => {
    const onUiLike = (d: any) => {
      if (!pairId || phase !== "connected") return;
      // قلب الحالة تفاؤليًا
      const optimistic = !likeData.isLiked;
      const snapshot = likeData;

      setLikeData((s) => ({
        ...s,
        isLiked: optimistic,
        peerLikes: Math.max(0, s.peerLikes + (optimistic ? 1 : -1)),
        canLike: false,
      }));

      (async () => {
        try {
          const dc = (globalThis as any).__ditonaDataChannel;
          const res = await likeApiThenDc(pairId, dc);
          if (res?.ok) {
            // حدّث من الخادم ليبقى العداد دقيقًا
            await pollOnce(pairId);
          } else {
            // فشل → رجوع
            setLikeData({ ...snapshot, canLike: true });
          }
        } catch {
          setLikeData({ ...snapshot, canLike: true });
        }
      })();
    };

    const off = on("ui:like", onUiLike as any);
    return () => { if (typeof off === "function") off(); };
  }, [pairId, phase, likeData]);

  // لا نرسم أي واجهة. يبقى هذا المكوّن خفيًا ويقوم فقط بالتنسيق.
  return null;
}
