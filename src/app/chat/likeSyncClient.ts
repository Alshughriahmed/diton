// src/app/chat/likeSyncClient.ts
"use client";

/**
 * توحيد سلوك زر الإعجاب:
 * - يستقبل "ui:like:toggle" من شريط الأدوات.
 * - ينفّذ POST /api/like ويقرأ count, liked|you.
 * - يبث like:sync للطرفين عبر DC + يحدّث محليًا فورًا.
 * - يسقط أي تحديث لا يخص الزوج الحالي.
 *
 * لا يغيّر أسماء الأحداث أو DOM.
 */

import type { Room } from "livekit-client";

declare global {
  interface Window {
    __lkRoom?: Room | null;
    __ditonaPairId?: string | null;
    __pairId?: string | null;
    __ditonaPeerDid?: string | null;
    __peerDid?: string | null;
  }
}

function curPair(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch { return null; }
}

function emitLikeSync(count: number, liked: boolean) {
  const pid = curPair();
  // حدث محلي للـUI
  try { window.dispatchEvent(new CustomEvent("like:sync", { detail: { pairId: pid, count, liked } })); } catch {}

  // بث عبر DC
  try {
    const room = (globalThis as any).__lkRoom as Room | undefined;
    if (room?.localParticipant) {
      const bytes = new TextEncoder().encode(JSON.stringify({ t: "like:sync", pairId: pid, count, liked }));
      room.localParticipant.publishData(bytes, { reliable: true, topic: "like" });
    }
  } catch {}
}

async function postLike(targetDid: string, liked: boolean): Promise<{count:number; liked:boolean; you?:boolean}> {
  const me = localStorage.getItem("ditona_did") || crypto.randomUUID();
  localStorage.setItem("ditona_did", me);

  const r = await fetch("/api/like", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-did": me },
    body: JSON.stringify({ targetDid, liked })
  }).then(r => r.json()).catch(() => ({} as any));

  const count = typeof r?.count === "number" ? r.count : 0;
  const you = typeof r?.you === "boolean" ? r.you : undefined;
  const okLiked = typeof r?.liked === "boolean" ? r.liked : (typeof you === "boolean" ? you : !!liked);
  return { count, liked: okLiked, you };
}

// آخر حالة معروفة لكل زوج لتفعيل التبديل عند غياب liked
const lastLikedByPair = new Map<string, boolean>();

// التقاط نقرة زر القلب من الـToolbar
(function boot(){
  window.addEventListener("ui:like:toggle", async (e: any) => {
    try {
      const pid = curPair();
      const targetDid = String(e?.detail?.targetDid || "") || (globalThis as any).__ditonaPeerDid || (globalThis as any).__peerDid || "";
      if (!targetDid) return;

      const explicitLiked = (typeof e?.detail?.liked === "boolean") ? !!e.detail.liked : undefined;
      const baseLiked = (pid && lastLikedByPair.has(pid)) ? !!lastLikedByPair.get(pid)! : false;
      const desired = typeof explicitLiked === "boolean" ? explicitLiked : !baseLiked;

      const { count, liked: finalLiked, you } = await postLike(targetDid, desired);
      if (pid) lastLikedByPair.set(pid, !!finalLiked);
      emitLikeSync(count, typeof you === "boolean" ? !!you : !!finalLiked);
    } catch {}
  });

  // مزامنة واردة من الـDC بصيغة قديمة you:boolean + تتبّع آخر حالة لكل زوج
  window.addEventListener("like:sync", (e: any) => {
    const d = e?.detail || {};
    const pid = typeof d?.pairId === "string" ? d.pairId : curPair();
    let liked = d?.liked;
    if (typeof d?.you === "boolean" && typeof liked !== "boolean") {
      liked = !!d.you;
      try { window.dispatchEvent(new CustomEvent("like:sync", { detail: { ...d, liked } })); } catch {}
    }
    if (pid && typeof liked === "boolean") {
      lastLikedByPair.set(pid, !!liked);
    }
  });
})();
