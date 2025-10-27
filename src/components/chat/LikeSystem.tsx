// src/components/chat/LikeSystem.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type LikeState = {
  count: number;      // عدّاد الطرف الآخر (B)
  you: boolean;       // هل أنا أحببته
  busy: boolean;      // منع النقرات المتتالية
};

function stableMyDid(): string {
  try {
    const k = "ditona_did";
    const v = localStorage.getItem(k);
    if (v) return v;
    const gen = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(k, gen);
    return gen;
  } catch {
    return "did-" + Math.random().toString(36).slice(2, 9);
  }
}

async function apiLike(opts: { targetDid: string; liked?: boolean }): Promise<{ count?: number; you?: boolean } | null> {
  try {
    const me = stableMyDid();
    const r = await fetch("/api/like", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json", "x-did": me },
      body: JSON.stringify(opts),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    // نتوقع {count, you}. إن اختلفت المفاتيح نُطبّعها
    if (j && typeof j === "object") {
      const count = Number(j.count ?? j.likes ?? 0);
      const you = Boolean(j.you ?? j.liked ?? j.meLiked);
      return { count: isFinite(count) ? count : 0, you };
    }
    return null;
  } catch {
    return null;
  }
}

export default function LikeSystem() {
  const [st, setSt] = useState<LikeState>({ count: 0, you: false, busy: false });
  const [visible, setVisible] = useState(false);
  const peerDidRef = useRef<string | null>(null);

  // ظهور/اختفاء الودجت حسب المرحلة
  useEffect(() => {
    const onPhase = (e: any) => {
      const ph = e?.detail?.phase;
      // لا نعرض أيقونة القلب أثناء البحث
      if (ph === "connected") setVisible(true);
      if (ph === "searching" || ph === "matched" || ph === "stopped" || ph === "idle") {
        setVisible(false);
        peerDidRef.current = null;
        setSt({ count: 0, you: false, busy: false });
      }
    };
    window.addEventListener("rtc:phase", onPhase as any);
    return () => window.removeEventListener("rtc:phase", onPhase as any);
  }, []);

  // التهيئة عند ظهور زوج جديد: نقرأ peerDid ونزامن العدّاد من الـAPI
  useEffect(() => {
    const onPair = () => {
      const did = (globalThis as any).__ditonaPeerDid || (globalThis as any).__peerDid || null;
      peerDidRef.current = typeof did === "string" && did ? did : null;
      setSt((s) => ({ ...s, busy: true }));
      if (peerDidRef.current) {
        // قراءة أولية عبر POST بدون liked
        apiLike({ targetDid: peerDidRef.current }).then((res) => {
          setSt({
            count: res?.count ?? 0,
            you: !!res?.you,
            busy: false,
          });
        });
      } else {
        setSt({ count: 0, you: false, busy: false });
      }
    };
    window.addEventListener("rtc:pair", onPair as any);
    return () => window.removeEventListener("rtc:pair", onPair as any);
  }, []);

  // استماع لتزامن الـDC: like:sync {count, you?, pairId?}
  useEffect(() => {
    const onSync = (e: any) => {
      const d = e?.detail || {};
      if (typeof d.count === "number") {
        setSt((s) => ({ ...s, count: Math.max(0, d.count | 0) }));
      }
      if (typeof d.you === "boolean") {
        setSt((s) => ({ ...s, you: !!d.you }));
      }
    };
    window.addEventListener("like:sync", onSync as any);
    return () => window.removeEventListener("like:sync", onSync as any);
  }, []);

  async function toggleLike() {
    if (st.busy) return;
    const targetDid = peerDidRef.current;
    if (!targetDid) return;

    // تحديث متفائل
    const nextYou = !st.you;
    const nextCount = Math.max(0, st.count + (nextYou ? 1 : -1));
    setSt({ count: nextCount, you: nextYou, busy: true });

    // API الفعلي
    const res = await apiLike({ targetDid, liked: nextYou });
    if (res) {
      setSt({ count: res.count ?? nextCount, you: res.you ?? nextYou, busy: false });
      // دفع إشارة عبر الـDC عند النجاح
      try {
        const room: any = (globalThis as any).__lkRoom;
        if (room?.localParticipant?.publishData) {
          const bin = new TextEncoder().encode(JSON.stringify({ t: "like:sync", count: res.count ?? nextCount, you: res.you ?? nextYou }));
          room.localParticipant.publishData(bin, { reliable: true, topic: "like" });
        }
      } catch {}
    } else {
      // فشل → رجوع للحالة السابقة
      setSt({ count: Math.max(0, st.count), you: st.you, busy: false });
    }
  }

  if (!visible) return null;

  return (
    <div className="absolute right-4 top-4 z-30 pointer-events-auto select-none">
      {/* عدّاد الطرف الآخر */}
      <div className="mb-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black/50 border border-white/15 backdrop-blur">
        <span className="text-pink-400 text-sm">💖</span>
        <span className="text-white text-sm font-medium">{st.count}</span>
      </div>

      {/* زرّ التبديل */}
      <button
        onClick={toggleLike}
        disabled={st.busy || !peerDidRef.current}
        aria-label={st.you ? "Unlike" : "Like"}
        className={`block w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all
          ${st.you ? "bg-pink-500 border-pink-400 text-white" : "bg-black/50 border-white/30 text-white hover:border-pink-400"}
          ${st.busy ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <span className="text-2xl">{st.you ? "💗" : "🤍"}</span>
      </button>
    </div>
  );
}
