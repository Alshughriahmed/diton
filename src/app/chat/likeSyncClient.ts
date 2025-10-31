// src/app/chat/likeSyncClient.ts
"use client";

/**
 * جسر like من LiveKit DC → نافذة المتصفح.
 *
 * أهداف:
 *  - استقبال رسائل topic="like"
 *  - دعم الصيغ القديمة والجديدة:
 *      { t:"like:sync", pairId?, count, liked }
 *      { t:"like:sync", pairId?, count, you }  // نحول you→liked
 *      { t:"like", liked }                      // وميض بصري فقط للطرف الآخر
 *  - حقن pairId إن غاب باستخدام window.__ditonaPairId || __pairId
 *  - بث نافذة موحّد:
 *      window.dispatchEvent(new CustomEvent("like:sync",{detail:{pairId,count,liked}}))
 *  - بث وميض HUD اختياري عند {t:"like"}:
 *      window.dispatchEvent(new CustomEvent("rtc:peer-like",{detail:{pairId, liked}}))
 *
 * لا إرسال عبر DC من هنا. الإرسال يتم في LikeSystem.tsx فقط.
 * لا تغيير ENV. لا اعتماد خارجي.
 */

type LikeSyncEvt = {
  pairId?: string;
  count?: number;
  liked?: boolean;
  you?: boolean; // توافق
  t?: string;
};

function curPair(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

function toJson(bytes: Uint8Array | string): any {
  try {
    const s = typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes);
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function isLikeTopic(topic?: string | null) {
  return (topic || "").toLowerCase() === "like";
}

function handlePayload(p: any) {
  if (!p || typeof p !== "object") return;

  // 1) وميض بصري للطرف الآخر عند t:"like"
  if (p.t === "like" && typeof p.liked === "boolean") {
    const pid = p.pairId || curPair();
    window.dispatchEvent(
      new CustomEvent("rtc:peer-like", { detail: { pairId: pid, liked: p.liked } })
    );
    return;
  }

  // 2) مزامنة العدّاد t:"like:sync"
  if (p.t === "like:sync" || (typeof p.count === "number" && ("you" in p || "liked" in p))) {
    const pid = p.pairId || curPair();
    const liked = typeof p.liked === "boolean" ? p.liked : !!p.you;
    const count = typeof p.count === "number" ? p.count : undefined;

    if (typeof count === "number") {
      window.dispatchEvent(
        new CustomEvent("like:sync", { detail: { pairId: pid, count, liked } })
      );
    }
  }
}

function attachRoom(room: any) {
  if (!room || typeof room?.on !== "function") return;

  // LiveKit: RoomEvent.DataReceived
  const RoomEvent = (globalThis as any).livekit?.RoomEvent;
  const eventName = RoomEvent?.DataReceived || "data-received";
  const onData = (payload: Uint8Array, participant: any, kind: any, topic?: string) => {
    if (!isLikeTopic(topic)) return;
    const j = toJson(payload);
    handlePayload(j);
  };

  // حافظة لإزالة المستمع عند تبديل الغرفة
  const key = "__ditona_like_onData";
  // إزالة قديم
  try {
    const prev = (room as any)[key];
    if (prev) room.off?.(eventName, prev);
  } catch {}
  // ربط جديد
  room.on(eventName, onData as any);
  (room as any)[key] = onData;
}

// إرفاق تلقائي عند توفر __lkRoom أو عند lk:attached
(function boot() {
  function tryAttachFromGlobal() {
    try {
      const w: any = globalThis as any;
      const r = w.__lkRoom;
      if (r) attachRoom(r);
    } catch {}
  }

  // أول تشغيل
  tryAttachFromGlobal();

  // عند attach لاحق
  const onAttached = () => tryAttachFromGlobal();
  window.addEventListener("lk:attached", onAttached as any, { passive: true } as any);

  // تنظيف
  (globalThis as any).__ditonaLikeSyncCleanup = () => {
    window.removeEventListener("lk:attached", onAttached as any);
    try {
      const w: any = globalThis as any;
      const r = w.__lkRoom;
      const RoomEvent = (globalThis as any).livekit?.RoomEvent;
      const eventName = RoomEvent?.DataReceived || "data-received";
      const key = "__ditona_like_onData";
      const prev = r?.[key];
      if (r && prev) r.off?.(eventName, prev);
    } catch {}
  };
})();
