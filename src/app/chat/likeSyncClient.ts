// src/app/chat/likeSyncClient.ts
"use client";

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
  try { const w: any = globalThis as any; return w.__ditonaPairId || w.__pairId || null; }
  catch { return null; }
}
function lastMetaDid(): string | "" {
  try {
    const s = sessionStorage.getItem("ditona:last_peer_meta");
    if (!s) return "";
    const j = JSON.parse(s);
    return j?.did || j?.deviceId || j?.peerDid || j?.id || j?.identity || "";
  } catch { return ""; }
}

function emitLikeSync(count: number, liked: boolean) {
  const pid = curPair();
  try { window.dispatchEvent(new CustomEvent("like:sync", { detail: { pairId: pid, count, liked } })); } catch {}
  try {
    const room = (globalThis as any).__lkRoom as Room | undefined;
    if (room?.localParticipant) {
      const bytes = new TextEncoder().encode(JSON.stringify({ t: "like:sync", pairId: pid, count, liked }));
      room.localParticipant.publishData(bytes, { reliable: true, topic: "like" });
    }
  } catch {}
}

async function postLikeSmart(targetDid: string, liked: boolean): Promise<{count:number; liked:boolean; you?:boolean}> {
  const me = localStorage.getItem("ditona_did") || crypto.randomUUID();
  localStorage.setItem("ditona_did", me);

  async function call(url: string) {
    const r = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-did": me },
      body: JSON.stringify({ targetDid, liked }),
    });
    return { ok: r.ok, status: r.status, json: r.ok ? await r.json().catch(()=>({})) : {} };
  }

  // 1) حاول /api/like أولاً
  let out = await call("/api/like");
  if (!out.ok && (out.status === 404 || out.status === 405)) {
    // 2) سقط إلى /api/likes/toggle (الموجود في مشروعك)
    out = await call("/api/likes/toggle");
  }

  const j: any = out.json || {};
  const count = typeof j?.count === "number" ? j.count
              : typeof j?.peerLikes === "number" ? j.peerLikes
              : 0;
  const you = typeof j?.you === "boolean" ? j.you : undefined;
  const okLiked = typeof j?.liked === "boolean" ? j.liked
                : typeof j?.isLiked === "boolean" ? j.isLiked
                : (typeof you === "boolean" ? you : !!liked);
  return { count, liked: okLiked, you };
}

const lastLikedByPair = new Map<string, boolean>();

(function boot() {
  window.addEventListener("ui:like:toggle", async (e: any) => {
    try {
      const pid = curPair() || "PID";
      const targetDid =
        String(e?.detail?.targetDid || "") ||
        (globalThis as any).__ditonaPeerDid ||
        (globalThis as any).__peerDid ||
        lastMetaDid() || "";

      if (!targetDid) return; // لا هدف → لا طلب

      // toggle إذا لم يُمرر liked
      const explicitLiked = (typeof e?.detail?.liked === "boolean") ? !!e.detail.liked : undefined;
      const baseLiked = lastLikedByPair.has(pid) ? !!lastLikedByPair.get(pid)! : false;
      const desired = typeof explicitLiked === "boolean" ? explicitLiked : !baseLiked;

      const { count, liked: finalLiked, you } = await postLikeSmart(targetDid, desired);
      lastLikedByPair.set(pid, !!(typeof you === "boolean" ? you : finalLiked));
      emitLikeSync(count, typeof you === "boolean" ? !!you : !!finalLiked);
    } catch {}
  });

  // دمج صيغة قديمة you → liked + تتبّع آخر حالة
  window.addEventListener("like:sync", (e: any) => {
    const d = e?.detail || {};
    const pid = typeof d?.pairId === "string" ? d.pairId : curPair() || "PID";
    let liked = d?.liked;
    if (typeof d?.you === "boolean" && typeof liked !== "boolean") {
      liked = !!d.you;
      try { window.dispatchEvent(new CustomEvent("like:sync", { detail: { ...d, liked } })); } catch {}
    }
    if (typeof liked === "boolean") lastLikedByPair.set(pid, !!liked);
  });
})();
