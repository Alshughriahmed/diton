"use client";

import { useState, useEffect, useRef } from "react";
import { emit, on } from "@/utils/events";
import safeFetch from "@/app/chat/safeFetch";
import { likeApiThenDc } from "@/app/chat/likeSyncClient";
import { useProfile } from "@/state/profile";

interface LikeData {
  myLikes: number;
  peerLikes: number;
  isLiked: boolean;
  canLike: boolean;
}

export default function LikeSystem() {
  const { profile } = useProfile();
  const showCount = !!profile?.likes?.showCount;

  const [likeData, setLikeData] = useState<LikeData>({
    myLikes: 0,
    peerLikes: 0,
    isLiked: false,
    canLike: true,
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // ---- polling helpers ----
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    isPollingRef.current = false;
  };

  const pollLikeCount = async (pairId: string) => {
    if (!pairId || isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const r = await safeFetch(`/api/like?pairId=${encodeURIComponent(pairId)}`, { method: "GET" });
      if (r.ok) {
        const j = await r.json();
        setLikeData((prev) => ({
          ...prev,
          peerLikes: Number(j?.count ?? 0),
          isLiked: !!(j?.mine ?? j?.you),
          canLike: true,
        }));
      }
    } catch {
      /* noop */
    } finally {
      isPollingRef.current = false;
    }
  };

  const startPolling = (pairId: string) => {
    stopPolling();
    // لا حاجة للـpolling إذا كان العداد مخفياً
    if (!showCount) return;
    // poll الآن ثم كل ثانيتين
    pollLikeCount(pairId);
    pollingIntervalRef.current = setInterval(() => pollLikeCount(pairId), 2000);
  };

  // ---- wiring ----
  useEffect(() => {
    const offPair = on("rtc:pair" as any, (data) => {
      const pid = data?.pairId;
      if (!pid) return;
      setCurrentPairId(pid);
      setLikeData({ myLikes: 0, peerLikes: 0, isLiked: false, canLike: true });
      startPolling(pid);
    });

    const offPhase = on("rtc:phase" as any, (d) => {
      const ph = d?.phase;
      if (ph === "idle" || ph === "stopped" || ph === "searching") {
        stopPolling();
        setCurrentPairId(null);
        setLikeData({ myLikes: 0, peerLikes: 0, isLiked: false, canLike: true });
      }
    });

    // استمع لتزامن العدّاد عبر DC
    const offSync = on("like:sync" as any, (ev) => {
      const det = ev || {};
      const cur = (globalThis as any).__pairId || (globalThis as any).__ditonaPairId || null;
      if (det.pairId && cur && det.pairId !== cur) return;

      if (typeof det.count === "number") {
        setLikeData((s) => ({ ...s, peerLikes: Math.max(0, Number(det.count) || 0) }));
      }
      if (typeof det.likedByMe === "boolean") {
        setLikeData((s) => ({ ...s, isLiked: det.likedByMe }));
      }
    });

    // عند إغلاق القناة ارجع للـpolling فقط
    const onDcClosed = () => {
      if (currentPairId) startPolling(currentPairId);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("ditona:datachannel-closed", onDcClosed);
    }

    return () => {
      typeof offPair === "function" && offPair();
      typeof offPhase === "function" && offPhase();
      typeof offSync === "function" && offSync();
      if (typeof window !== "undefined") {
        window.removeEventListener("ditona:datachannel-closed", onDcClosed);
      }
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPairId]);

  // إعادة تهيئة polling عند تغيّر سياسة عرض العداد
  useEffect(() => {
    if (currentPairId) {
      startPolling(currentPairId);
    } else {
      stopPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCount]);

  // ---- like action ----
  const handleLike = async () => {
    if (!likeData.canLike || isAnimating || !currentPairId) return;

    const newIsLiked = !likeData.isLiked;
    const original = { ...likeData };

    // تحديث متفائل
    setLikeData((s) => ({
      ...s,
      isLiked: newIsLiked,
      peerLikes: showCount ? (newIsLiked ? s.peerLikes + 1 : Math.max(0, s.peerLikes - 1)) : s.peerLikes,
      canLike: false,
    }));

    // حركة
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
      const dc = (globalThis as any).__ditonaDataChannel;
      const res = await likeApiThenDc(currentPairId, dc);

      if (res?.ok && !res?.duplicate) {
        // جلب الحالة الحقيقية
        if (showCount) {
          const g = await safeFetch(`/api/like?pairId=${encodeURIComponent(currentPairId)}`, { method: "GET" });
          if (g.ok) {
            const j = await g.json();
            setLikeData((s) => ({
              ...s,
              peerLikes: Number(j?.count ?? s.peerLikes),
              isLiked: !!(j?.mine ?? j?.you ?? s.isLiked),
              canLike: true,
            }));
            emit("ui:like", { isLiked: !!(j?.mine ?? j?.you), myLikes: Number(j?.count ?? 0), pairId: currentPairId });
          } else {
            setLikeData((s) => ({ ...s, canLike: true }));
          }
        } else {
          setLikeData((s) => ({ ...s, canLike: true }));
        }
      } else if (res?.duplicate) {
        setLikeData((s) => ({ ...s, canLike: true }));
      } else {
        setLikeData({ ...original, canLike: true });
      }
    } catch {
      setLikeData({ ...original, canLike: true });
    }
  };

  return (
    <div className="absolute top-4 right-4 z-30">
      <div className="flex flex-col items-center gap-2">
        {/* Peer Likes Display */}
        {showCount && (
          <div className="flex items-center gap-1 px-3 py-1 bg-black/50 backdrop-blur rounded-full border border-white/20">
            <span className="text-pink-400 text-sm">💖</span>
            <span className="text-white text-sm font-medium">{likeData.peerLikes}</span>
          </div>
        )}

        {/* Like Button */}
        <button
          onClick={handleLike}
          disabled={!likeData.canLike || isAnimating}
          className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            likeData.isLiked ? "bg-pink-500 border-pink-400 text-white scale-110"
                              : "bg-black/50 border-white/30 text-white hover:border-pink-400 hover:bg-pink-500/20"
          } ${isAnimating ? "scale-125" : ""} ${!likeData.canLike ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={likeData.isLiked ? "Unlike" : "Like"}
        >
          <span className={`text-2xl transition-transform ${isAnimating ? "scale-125" : ""}`}>
            {likeData.isLiked ? "💗" : "🤍"}
          </span>

          {showHeart && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl animate-ping text-pink-400">💖</span>
            </div>
          )}

          {isAnimating && <div className="absolute inset-0 rounded-full border-2 border-pink-400 animate-ping opacity-30" />}
        </button>

        {/* My Likes Counter */}
        {showCount && (
          <div className="flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur rounded-full border border-white/20">
            <span className="text-pink-400 text-xs">💕</span>
            <span className="text-white text-xs font-medium">{likeData.myLikes}</span>
          </div>
        )}
      </div>

      {showHeart && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-pink-500 text-white text-xs rounded-full whitespace-nowrap animate-fade-in-up">
          Added to friends! 💕
        </div>
      )}
    </div>
  );
}

// inject CSS once
if (typeof window !== "undefined" && !(window as any).__likeAnimCss) {
  (window as any).__likeAnimCss = 1;
  const css = `
    @keyframes fade-in-up { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform: translateY(0);} }
    .animate-fade-in-up { animation: fade-in-up 0.3s ease-out; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
