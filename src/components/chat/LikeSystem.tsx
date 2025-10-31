"use client";

import { useEffect, useRef, useState } from "react";
import { vibrate } from "@/lib/vibrate";

type LikeState = {
  isLiked: boolean;
  canLike: boolean;
  targetDid: string | null;
  pairId: string | null;
};

function stableDid(): string {
  try {
    const k = "ditona_did";
    let v = localStorage.getItem(k);
    if (!v) {
      v = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem(k, v);
    }
    return v;
  } catch { return "did-" + Math.random().toString(36).slice(2, 9); }
}
const curPair = () => (globalThis as any).__ditonaPairId || (globalThis as any).__pairId || null;
const curPeer = () => (globalThis as any).__ditonaPeerDid || (globalThis as any).__peerDid || null;

async function postLike(targetDid: string, liked?: boolean) {
  const me = stableDid();
  const r = await fetch("/api/like", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-did": me },
    body: JSON.stringify(liked === undefined ? { targetDid } : { targetDid, liked }),
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, j };
}

export default function LikeSystem() {
  const [st, setSt] = useState<LikeState>({
    isLiked: false, canLike: true, targetDid: curPeer(), pairId: curPair(),
  });
  const mounted = useRef(false);

  function emitSync(count?: number, you?: boolean) {
    const pid = curPair();
    try {
      const room: any = (globalThis as any).__lkRoom;
      const payload = { t: "like:sync", count, you, pairId: pid };
      room?.localParticipant?.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true, topic: "like" });
    } catch {}
    window.dispatchEvent(new CustomEvent("like:sync", { detail: { count, you, pairId: pid } }));
  }

  function sendPeerToggleDC(liked: boolean) {
    try {
      const room: any = (globalThis as any).__lkRoom;
      const payload = { t: "like", liked, pairId: curPair() };
      room?.localParticipant?.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true, topic: "like" });
    } catch {}
  }

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const syncTarget = () => setSt((s) => ({ ...s, targetDid: curPeer(), pairId: curPair() }));

    const onPair = () => {
      syncTarget();
      const did = curPeer();
      if (!did) return;
      // قراءة الحالة الأولية (you + count) وتوزيعها على HUDs
      postLike(did, undefined).then(({ ok, j }) => {
        if (!ok || !j) return;
        setSt((s) => ({ ...s, isLiked: !!j.you, canLike: true }));
        emitSync(j.count, j.you);
      });
    };

    const onPeerMeta = () => syncTarget();

    window.addEventListener("rtc:pair", onPair as any);
    window.addEventListener("ditona:peer-meta", onPeerMeta as any);

    const onSync = (e: any) => {
      const d = e?.detail || {};
      const pid = curPair();
      if (d?.pairId && pid && d.pairId !== pid) return;
      if (typeof d.you === "boolean") setSt((s) => ({ ...s, isLiked: d.you }));
    };
    window.addEventListener("like:sync", onSync as any);

    // أوامر الواجهة (وحيد المسؤول عن التبديل لتجنب ازدواج)
    const onUiLike = (e: any) => { void toggle(e?.detail?.liked); };
    window.addEventListener("ui:like", onUiLike as any);
    window.addEventListener("ui:like:toggle", onUiLike as any);

    // بدء
    onPair();

    return () => {
      window.removeEventListener("rtc:pair", onPair as any);
      window.removeEventListener("ditona:peer-meta", onPeerMeta as any);
      window.removeEventListener("like:sync", onSync as any);
      window.removeEventListener("ui:like", onUiLike as any);
      window.removeEventListener("ui:like:toggle", onUiLike as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(force?: boolean) {
    if (!st.canLike || !st.targetDid) return;
    const next = typeof force === "boolean" ? !!force : !st.isLiked;

    vibrate(16);

    // تفاؤلي + DC خفيف للطرف الآخر فورًا
    setSt((s) => ({ ...s, isLiked: next, canLike: false }));
    sendPeerToggleDC(next);

    const { ok, j } = await postLike(st.targetDid, next);
    if (!ok || !j) {
      // revert
      setSt((s) => ({ ...s, isLiked: !next, canLike: true }));
      sendPeerToggleDC(!next);
      return;
    }
    emitSync(j.count, j.you);
    setSt((s) => ({ ...s, canLike: true }));
  }

  return null; // headless
}
