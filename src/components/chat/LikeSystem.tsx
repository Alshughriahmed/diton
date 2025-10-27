"use client";

import { useEffect, useRef, useState } from "react";

/** Headless controller لإدارة الإعجاب. لا يرسم زرًا. */
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

async function likePost(targetDid: string, liked: boolean) {
  const me = stableDid();
  const r = await fetch("/api/like", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-did": me },
    body: JSON.stringify({ targetDid, liked }),
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, j };
}

export default function LikeSystem() {
  const [st, setSt] = useState<LikeState>({
    isLiked: false,
    canLike: true,
    targetDid: curPeerDid(),
    pairId: curPair(),
  });
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const syncTarget = () =>
      setSt((s) => ({ ...s, targetDid: curPeerDid(), pairId: curPair() }));

    const onPair = () => syncTarget();
    const onPeerMeta = () => syncTarget();

    window.addEventListener("rtc:pair", onPair as any);
    window.addEventListener("ditona:peer-meta", onPeerMeta as any);

    // تحديث حالة الزر عندما يصل like:sync
    const onSync = (e: any) => {
      const d = e?.detail || {};
      const pid = curPair();
      if (d?.pairId && pid && d.pairId !== pid) return;
      if (typeof d.you === "boolean") setSt((s) => ({ ...s, isLiked: d.you }));
    };
    window.addEventListener("like:sync", onSync as any);

    // أوامر UI
    const onUiLike = (e: any) => {
      const want = e?.detail?.liked;
      toggle(want);
    };
    window.addEventListener("ui:like", onUiLike as any);
    window.addEventListener("ui:like:toggle", onUiLike as any);

    // بداية
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

    // تحديث تفاؤلي
    setSt((s) => ({ ...s, isLiked: next, canLike: false }));

    const { ok, j } = await likePost(st.targetDid, next);
    if (!ok || !j) {
      setSt((s) => ({ ...s, isLiked: !next, canLike: true }));
      return;
    }

    const pid = curPair();
    // بثّ sync: DC + حدث محلي
    try {
      const room: any = (globalThis as any).__lkRoom;
      const payload = { t: "like:sync", count: j.count, you: j.you, pairId: pid };
      room?.localParticipant?.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true, topic: "like" }
      );
    } catch {}
    window.dispatchEvent(
      new CustomEvent("like:sync", { detail: { count: j.count, you: j.you, pairId: pid } })
    );

    setSt((s) => ({ ...s, canLike: true }));
  }

  return null; // Headless
}
