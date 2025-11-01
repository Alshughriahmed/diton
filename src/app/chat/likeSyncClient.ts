"use client";

/**
 * توحيد سلوك زر الإعجاب:
 * - يستقبل "ui:like:toggle" من شريط الأدوات.
 * - ينفّذ POST /api/like ويقرأ count, liked.
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

async function postLike(targetDid: string, liked: boolean): Promise<{count:number; liked:boolean}> {
  const me = localStorage.getItem("ditona_did") || crypto.randomUUID();
  localStorage.setItem("ditona_did", me);

  const r = await fetch("/api/like", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-did": me },
    body: JSON.stringify({ targetDid, liked })
  }).then(r => r.json()).catch(() => ({} as any));

  const count = typeof r?.count === "number" ? r.count : 0;
  const okLiked = typeof r?.liked === "boolean" ? r.liked : !!liked;
  return { count, liked: okLiked };
}

// التقاط نقرة زر القلب من الـToolbar
(function boot(){
  window.addEventListener("ui:like:toggle", async (e: any) => {
    try {
      const targetDid = String(e?.detail?.targetDid || "") || (globalThis as any).__ditonaPeerDid || (globalThis as any).__peerDid || "";
      const liked = !!e?.detail?.liked;

      const { count, liked: finalLiked } = await postLike(targetDid, liked);
      emitLikeSync(count, finalLiked);
    } catch {}
  });

  // مزامنة واردة من الـDC بصيغة قديمة you:boolean
  window.addEventListener("like:sync", (e: any) => {
    const d = e?.detail || {};
    if (d && typeof d.you === "boolean" && typeof d.liked !== "boolean") {
      d.liked = !!d.you;
      delete d.you;
      try { window.dispatchEvent(new CustomEvent("like:sync", { detail: d })); } catch {}
    }
  });
})();
