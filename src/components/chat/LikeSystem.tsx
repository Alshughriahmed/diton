// src/components/chat/LikeSystem.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { emit, on } from "@/utils/events";
import safeFetch from "@/app/chat/safeFetch";
import { likeApiThenDc } from "@/app/chat/likeSyncClient";

type Phase = "boot" | "idle" | "searching" | "matched" | "connected" | "stopped";

interface LikeData {
  myLikes: number;
  peerLikes: number;
  isLiked: boolean;
  canLike: boolean;
}

export default function LikeSystem() {
  // ----- حالة المرحلة لضبط الظهور والتشغيل -----
  const [phase, setPhase] = useState<Phase>("idle");
  const isConnected = phase === "connected";

  // ----- حالة اللايك -----
  const [likeData, setLikeData] = useState<LikeData>({
    myLikes: 0,
    peerLikes: 0,
    isLiked: false,
    canLike: true,
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHeart, setShowHeart] = useState(false);

  // ----- معرف الزوج -----
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);

  // ----- Polling -----
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // phase wiring
  useEffect(() => {
    const off = on("rtc:phase" as any, (d: any) => setPhase(d?.phase || "idle"));
    return () => {
      if (typeof off === "function") off();
    };
  }, []);

  // pair wiring: حدّث الزوج وامسح الحالة للزوج الجديد
  useEffect(() => {
    const off = on("rtc:pair" as any, (data) => {
      const pid = data?.pairId;
      if (!pid) return;
      setCurrentPairId(pid);
      setLikeData((prev) => ({
        ...prev,
        peerLikes: 0,
        isLiked: false,
        canLike: true,
      }));
    });
    return () => {
      if (typeof off === "function") off();
    };
  }, []);

  // دالة Poll واحدة
  const pollLikeCount = async (pairId: string) => {
    if (!pairId || isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const r = await safeFetch(`/api/like?pairId=${encodeURIComponent(pairId)}`, { method: "GET" });
      if (r.ok) {
        const j = await r.json();
        setLikeData((prev) => ({
          ...prev,
          peerLikes: j.count || 0,
          isLiked: !!(j.mine ?? j.you),
          canLike: true,
        }));
      }
    } catch {
      // تجاهل
    } finally {
      isPollingRef.current = false;
    }
  };

  const startPolling = (pairId: string) => {
    stopPolling();
    // poll فوري ثم كل 2 ثانية
    pollLikeCount(pairId);
    pollingIntervalRef.current = setInterval(() => pollLikeCount(pairId), 2000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // شغّل/أوقف الـpolling فقط عند الاتصال ومع وجود pairId
  useEffect(() => {
    if (isConnected && currentPairId) startPolling(currentPairId);
    else stopPolling();
    return () => stopPolling();
  }, [isConnected, currentPairId]);

  // لو أُغلق الـDC، نعتمد على الـpolling الذي تم ضبطه أعلاه
  useEffect(() => {
    const onClosed = () => {
      // لا شيء إضافي هنا؛ الاعتماد على isConnected/currentPairId effect
    };
    if (typeof window !== "undefined") {
      window.addEventListener("ditona:datachannel-closed", onClosed);
      return () => window.removeEventListener("ditona:datachannel-closed", onClosed);
    }
  }, []);

  // توافق خلفي مع أي مكوّن يرسل تحديثات مباشرة
  useEffect(() => {
    const off = on("ui:likeUpdate", (data) => {
      if (!data) return;
      setLikeData((prev) => ({ ...prev, ...data }));
    });
    return () => {
      if (typeof off === "function") off();
    };
  }, []);

  // زر الإعجاب
  const handleLike = async () => {
    if (!isConnected || !currentPairId || !likeData.canLike || isAnimating) return;

    const newIsLiked = !likeData.isLiked;
    const original = { ...likeData };

    // تحديث متفائل
    setLikeData((prev) => ({
      ...prev,
      isLiked: newIsLiked,
      peerLikes: newIsLiked ? prev.peerLikes + 1 : Math.max(0, prev.peerLikes - 1),
      canLike: false,
    }));

    // مؤثرات
    setIsAnimating(true);
    if (newIsLiked) {
      try {
        if (typeof window !== "undefined") window.dispatchEvent(new Event("user:liked"));
      } catch {}
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 1000);
    }
    setTimeout(() => setIsAnimating(false), 300);

    try {
      // P6: API أولًا ثم DC (مع idempotency داخل likeApiThenDc)
      const dc = (globalThis as any).__ditonaDataChannel;
      const result = await likeApiThenDc(currentPairId, dc);

      if (result && result.ok && !result.duplicate) {
        // جلب الحالة الفعلية
        const gr = await safeFetch(`/api/like?pairId=${encodeURIComponent(currentPairId)}`, { method: "GET" });
        if (gr.ok) {
          const j = await gr.json();
          setLikeData((prev) => ({
            ...prev,
            peerLikes: j.count || 0,
            isLiked: !!(j.you ?? j.mine),
            canLike: true,
          }));
          // إشعار للتوافق مع ChatClient القديم
          emit("ui:like", {
            isLiked: !!(j.you ?? j.mine),
            myLikes: j.count || 0,
            pairId: currentPairId,
          });
        } else {
          setLikeData((prev) => ({ ...prev, canLike: true }));
        }
      } else if (result && result.duplicate) {
        setLikeData((prev) => ({ ...prev, canLike: true }));
      } else {
        // فشل الخادم
        setLikeData({ ...original, canLike: true });
      }
    } catch {
      // فشل الشبكة
      setLikeData({ ...original, canLike: true });
    }
  };

  // لا نعرض أي شيء إلا عند الاتصال
  if (!isConnected) return null;

  return (
    <div className="absolute top-4 right-4 z-30 pointer-events-none">
      <div className="flex flex-col items-center gap-2">
        {/* عداد إعجابات الطرف */}
        <div className="flex items-center gap-1 px-3 py-1 bg-black/50 backdrop-blur rounded-full border border-white/20 pointer-events-auto">
          <span className="text-pink-400 text-sm">💖</span>
          <span className="text-white text-sm font-medium">{likeData.peerLikes}</span>
        </div>

        {/* زر الإعجاب */}
        <button
          onClick={handleLike}
          disabled={!likeData.canLike || isAnimating}
          className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300 pointer-events-auto ${
            likeData.isLiked
              ? "bg-pink-500 border-pink-400 text-white scale-110"
              : "bg-black/50 border-white/30 text-white hover:border-pink-400 hover:bg-pink-500/20"
          } ${isAnimating ? "scale-125" : ""} ${!likeData.canLike ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={likeData.isLiked ? "Unlike" : "Like"}
        >
          <span className={`text-2xl transition-transform ${isAnimating ? "scale-125" : ""}`}>
            {likeData.isLiked ? "💗" : "🤍"}
          </span>

          {/* Heart ping */}
          {showHeart && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl animate-ping text-pink-400">💖</span>
            </div>
          )}

          {/* Ripple */}
          {isAnimating && <div className="absolute inset-0 rounded-full border-2 border-pink-400 animate-ping opacity-30" />}
        </button>

        {/* عداد خاصتي الاختياري */}
        <div className="flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur rounded-full border border-white/20 pointer-events-auto">
          <span className="text-pink-400 text-xs">💕</span>
          <span className="text-white text-xs font-medium">{likeData.myLikes}</span>
        </div>
      </div>

      {/* رسالة نجاح */}
      {showHeart && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-pink-500 text-white text-xs rounded-full whitespace-nowrap animate-fade-in-up pointer-events-auto">
          Added to friends! 💕
        </div>
      )}
    </div>
  );
}

/* CSS Animation */
const animationStyles = `
  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in-up { animation: fade-in-up 0.3s ease-out; }
`;

if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.innerText = animationStyles;
  document.head.appendChild(style);
}
