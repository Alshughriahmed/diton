// src/app/chat/likeSyncClient.ts
"use client";

/**
 * جسر like من LiveKit DC → نافذة المتصفح.
 * - يدعم الصيغ:
 *   { t:"like:sync", pairId?, count, liked } | { t:"like:sync", pairId?, count, you }
 *   { t:"like", liked }  ← وميض HUD فقط
 * - يحقن pairId إن غاب.
 * - يبث نافذة موحّد: "like:sync" {pairId,count,liked}
 * - لا إرسال DC من هنا.
 */

type LikeSyncEvt = {
  pairId?: string;
  count?: number;
  liked?: boolean;
  you?: boolean; // توافق
  t?: string;
};

function curPair_like(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

function toJson_like(bytes: Uint8Array | string): any {
  try {
    const s = typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes);
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function isLikeTopic_like(topic?: string | null) {
  return (topic || "").toLowerCase() === "like";
}

function handlePayload_like(p: any) {
  if (!p || typeof p !== "object") return;

  // وميض بصري للطرف الآخر
  if (p.t === "like" && typeof p.liked === "boolean") {
    const pid = p.pairId || curPair_like();
    window.dispatchEvent(
      new CustomEvent("rtc:peer-like", { detail: { pairId: pid, liked: p.liked } })
    );
    return;
  }

  // مزامنة العدّاد
  if (p.t === "like:sync" || (typeof p.count === "number" && ("you" in p || "liked" in p))) {
    const pid = p.pairId || curPair_like();
    const liked = typeof p.liked === "boolean" ? p.liked : !!p.you;
    const count = typeof p.count === "number" ? p.count : undefined;
    if (typeof count === "number") {
      window.dispatchEvent(
        new CustomEvent("like:sync", { detail: { pairId: pid, count, liked } })
      );
    }
  }
}

function attachRoom_like(room: any) {
  if (!room || typeof room?.on !== "function") return;

  const RoomEvent = (globalThis as any).livekit?.RoomEvent;
  const eventName = RoomEvent?.DataReceived || "data-received";

  const onData = (payload: Uint8Array, _participant: any, _kind: any, topic?: string) => {
    if (!isLikeTopic_like(topic)) return;
    const j = toJson_like(payload);
    handlePayload_like(j);
  };

  const key = "__ditona_like_onData";
  try {
    const prev = (room as any)[key];
    if (prev) room.off?.(eventName, prev);
  } catch {}
  room.on(eventName, onData as any);
  (room as any)[key] = onData;
}

(function boot_like() {
  function tryAttachFromGlobal() {
    try {
      const w: any = globalThis as any;
      const r = w.__lkRoom;
      if (r) attachRoom_like(r);
    } catch {}
  }

  tryAttachFromGlobal();

  const onAttached = () => tryAttachFromGlobal();
  window.addEventListener("lk:attached", onAttached as any, { passive: true } as any);

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
