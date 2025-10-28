"use client";
import { useEffect, useRef, useState } from "react";

type LikeState = {
  isLiked: boolean;       // أنا أحببت الطرف
  canLike: boolean;
  targetDid: string | null;
  pairId: string | null;
};

function stableDid(): string {
  try {
    const k = "ditona_did";
    let v = localStorage.getItem(k);
    if (!v) { v = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 9); localStorage.setItem(k, v); }
    return v;
  } catch { return "did-" + Math.random().toString(36).slice(2, 9); }
}
const curPair   = () => (globalThis as any).__ditonaPairId || (globalThis as any).__pairId || null;
const curPeerId = () => (globalThis as any).__ditonaPeerDid || (globalThis as any).__peerDid || null;

async function postLike(targetDid: string, liked: boolean) {
  const me = stableDid();
  const r = await fetch("/api/like", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-did": me },
    body: JSON.stringify({ targetDid, liked }),
    cache: "no-store",
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, j };
}

export default function LikeSystem() {
  const [st, setSt] = useState<LikeState>({ isLiked: false, canLike: true, targetDid: curPeerId(), pairId: curPair() });
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const syncTarget = () => setSt(s => ({ ...s, targetDid: curPeerId(), pairId: curPair() }));

    const onPair = () => { syncTarget(); setSt(s => ({ ...s, isLiked: false })); };
    const onPeerMeta = () => syncTarget();

    window.addEventListener("rtc:pair", onPair as any);
    window.addEventListener("ditona:peer-meta", onPeerMeta as any);

    // استلام المزامنة: نحدّث isLiked فقط إذا جاء likedByMe/you
    const onSync = (e: any) => {
      const d = e?.detail || {};
      const pid = curPair();
      if (d?.pairId && pid && d.pairId !== pid) return;
      if (typeof d.likedByMe === "boolean") setSt(s => ({ ...s, isLiked: !!d.likedByMe }));
      else if (typeof d.you === "boolean") setSt(s => ({ ...s, isLiked: !!d.you }));
    };
    window.addEventListener("like:sync", onSync as any);

    // أمر الواجهة: toggle دائمًا
    const onUiLike = () => toggle();
    window.addEventListener("ui:like", onUiLike as any);
    window.addEventListener("ui:like:toggle", onUiLike as any);

    return () => {
      window.removeEventListener("rtc:pair", onPair as any);
      window.removeEventListener("ditona:peer-meta", onPeerMeta as any);
      window.removeEventListener("like:sync", onSync as any);
      window.removeEventListener("ui:like", onUiLike as any);
      window.removeEventListener("ui:like:toggle", onUiLike as any);
    };
  }, []);

  async function toggle() {
    if (!st.canLike || !st.targetDid) return;
    const next = !st.isLiked;

    // تفاؤلي + بثّ فوري للطرف الآخر
    setSt(s => ({ ...s, isLiked: next, canLike: false }));
    try {
      const room: any = (globalThis as any).__lkRoom;
      const payload = new TextEncoder().encode(JSON.stringify({ t: "like", liked: next }));
      await room?.localParticipant?.publishData?.(payload, { reliable: true, topic: "like" });
    } catch {}

    const { ok, j } = await postLike(st.targetDid, next);
    const pid = curPair();

    if (!ok || !j) {
      // تراجع
      setSt(s => ({ ...s, isLiked: !next, canLike: true }));
      try {
        const room: any = (globalThis as any).__lkRoom;
        const payload = new TextEncoder().encode(JSON.stringify({ t: "like", liked: !next }));
        await room?.localParticipant?.publishData?.(payload, { reliable: true, topic: "like" });
      } catch {}
      return;
    }

    // مزامنة محلية + للطرف الآخر بالعدّاد
    try { window.dispatchEvent(new CustomEvent("like:sync", { detail: { pairId: pid, likedByMe: j.liked, count: j.count } })); } catch {}
    try {
      const room: any = (globalThis as any).__lkRoom;
      const payload2 = new TextEncoder().encode(JSON.stringify({ t: "like:sync", liked: !!j.liked, count: j.count }));
      await room?.localParticipant?.publishData?.(payload2, { reliable: true, topic: "like" });
    } catch {}
    setSt(s => ({ ...s, canLike: true }));
  }

  return null; // headless
}
