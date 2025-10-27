// src/components/chat/LikeSystem.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type LikeState = {
  isLiked: boolean;
  canLike: boolean;
  hidden: boolean;          // أخفِ الزر إلا عند connected
  targetDid: string | null; // DID للطرف
  pairId: string | null;    // للفلترة في أحداث sync
};

function stableDid(): string {
  try {
    const k = "ditona_did";
    let v = localStorage.getItem(k);
    if (!v) { v = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 9); localStorage.setItem(k, v); }
    return v;
  } catch {
    return "did-" + Math.random().toString(36).slice(2, 9);
  }
}

function curPair(): string | null {
  const w: any = globalThis as any;
  return w.__ditonaPairId || w.__pairId || null;
}

function curPeerDid(): string | null {
  const w: any = globalThis as any;
  return w.__ditonaPeerDid || w.__peerDid || null;
}

async function likePost(targetDid: string, liked?: boolean) {
  const me = stableDid();
  const r = await fetch("/api/like", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-did": me },
    body: JSON.stringify(liked == null ? { targetDid } : { targetDid, liked }),
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, j };
}

export default function LikeSystem() {
  const [st, setSt] = useState<LikeState>({
    isLiked: false,
    canLike: true,
    hidden: true,
    targetDid: curPeerDid(),
    pairId: curPair(),
  });

  const mounted = useRef(false);

  // طور الاتصال يُظهر/يخفي
  useEffect(() => {
    const onPhase = (e: any) => {
      const ph = e?.detail?.phase;
      setSt(s => ({ ...s, hidden: ph !== "connected" }));
    };
    window.addEventListener("rtc:phase", onPhase as any);
    // حالة البداية
    setSt(s => ({ ...s, hidden: (globalThis as any).__lkRoom?.state !== "connected" }));
    return () => window.removeEventListener("rtc:phase", onPhase as any);
  }, []);

  // التثبيت الأول + التقاط الـDID عند كل pair أو عند وصول meta
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const syncTarget = () =>
      setSt(s => ({ ...s, targetDid: curPeerDid(), pairId: curPair() }));

    const onPair = () => {
      syncTarget();
      const did = curPeerDid();
      if (!did) return;
      // قراءة الحالة الأولية بالـPOST فقط
      likePost(did, undefined).then(({ ok, j }) => {
        if (!ok || !j) return;
        setSt(s => ({ ...s, isLiked: !!j.you, canLike: true }));
        // ادفع sync للواجهة الأخرى ولمراقبينا المحليين
        const pid = curPair();
        try {
          const room: any = (globalThis as any).__lkRoom;
          const payload = { t: "like:sync", count: j.count, you: j.you, pairId: pid };
          room?.localParticipant?.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true, topic: "like" });
        } catch {}
        window.dispatchEvent(new CustomEvent("like:sync", { detail: { count: j.count, you: j.you, pairId: pid } }));
      });
    };

    const onPeerMeta = () => syncTarget();

    window.addEventListener("rtc:pair", onPair as any);
    window.addEventListener("ditona:peer-meta", onPeerMeta as any);
    // تزامن عدّاد من بث خارجي
    const onSync = (e: any) => {
      const d = e?.detail || {};
      const pid = curPair();
      if (d?.pairId && pid && d.pairId !== pid) return;
      // لا نرسم العداد هنا؛ PeerOverlay يتكفل. فقط نحدّث حالة الزر.
      if (typeof d.you === "boolean") setSt(s => ({ ...s, isLiked: d.you }));
    };
    window.addEventListener("like:sync", onSync as any);

    // بداية
    onPair();

    return () => {
      window.removeEventListener("rtc:pair", onPair as any);
      window.removeEventListener("ditona:peer-meta", onPeerMeta as any);
      window.removeEventListener("like:sync", onSync as any);
    };
  }, []);

  async function onToggle() {
    if (!st.canLike || !st.targetDid) return;
    const next = !st.isLiked;
    // تحديث تفاؤلي
    setSt(s => ({ ...s, isLiked: next, canLike: false }));
    const { ok, j } = await likePost(st.targetDid, next);
    if (!ok || !j) {
      // تراجع
      setSt(s => ({ ...s, isLiked: !next, canLike: true }));
      return;
    }
    const pid = curPair();
    // بثّ sync: DC + حدث محلّي (ليلتقطه PeerOverlay)
    try {
      const room: any = (globalThis as any).__lkRoom;
      const payload = { t: "like:sync", count: j.count, you: j.you, pairId: pid };
      room?.localParticipant?.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true, topic: "like" });
    } catch {}
    window.dispatchEvent(new CustomEvent("like:sync", { detail: { count: j.count, you: j.you, pairId: pid } }));
    setSt(s => ({ ...s, canLike: true }));
  }

  if (st.hidden || !st.targetDid) return null;

  return (
    <div className="absolute top-4 right-4 z-30">
      <button
        onClick={onToggle}
        disabled={!st.canLike}
        aria-label={st.isLiked ? "Unlike" : "Like"}
        className={`w-12 h-12 rounded-full border-2 grid place-items-center transition-all
        ${st.isLiked ? "bg-pink-500 border-pink-400 text-white scale-110"
                     : "bg-black/50 border-white/30 text-white hover:border-pink-400 hover:bg-pink-500/20"}`}
      >
        <span className="text-2xl">{st.isLiked ? "💗" : "🤍"}</span>
      </button>
    </div>
  );
}
