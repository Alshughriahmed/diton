// src/app/chat/likeSyncClient.ts
"use client";

/**
 * مزامنة إعجاب عبر LiveKit وDC الشيم:
 * - يستمع لـ room.on("dataReceived") topic="like" ويمرّر like:sync كحدث window.
 * - يحوّل {t:"like", liked} القديمة إلى "rtc:peer-like".
 * - يظل يستمع لقناة __ditonaDataChannel أيضًا.
 * - يوفّر likeApiThenDc() لإرسال إشعار إعجاب عندما لا نحتاج API.
 */

function parseMaybeJSON(data: any): any | null {
  try {
    if (typeof data === "string") return JSON.parse(data);
    if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(new Uint8Array(data)));
    if (ArrayBuffer.isView(data)) return JSON.parse(new TextDecoder().decode(data as any));
    return null;
  } catch { return null; }
}

function emitLikeSync(payload: any) {
  try { window.dispatchEvent(new CustomEvent("like:sync", { detail: payload })); } catch {}
}

function emitPeerLike(liked: boolean) {
  try {
    window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked } }));
    window.dispatchEvent(new CustomEvent("ditona:like:recv", { detail: { liked } }));
  } catch {}
}

function currentPair(): string | null {
  const w: any = globalThis as any;
  return w.__ditonaPairId || w.__pairId || null;
}

function handleLikeEnvelope(j: any) {
  // الشكل القديم
  if (j?.t === "like" && typeof j.liked === "boolean") {
    emitPeerLike(!!j.liked);
    return true;
  }
  // مزامنة رسمية
  if (j?.t === "like:sync" && (typeof j.count === "number" || typeof j.you === "boolean")) {
    const pid = j.pairId || currentPair();
    emitLikeSync({ count: j.count, you: j.you, pairId: pid });
    return true;
  }
  // شكل تجريبي سابق
  if (j?.type === "like:toggled" && j?.payload && typeof j.payload.liked === "boolean") {
    emitPeerLike(!!j.payload.liked);
    return true;
  }
  return false;
}

function bindLiveKit(room: any) {
  if (!room || typeof room.on !== "function") return;
  const w: any = window as any;
  if (w.__likeSyncLKBound) return;
  w.__likeSyncLKBound = 1;

  room.on("dataReceived", (payload: Uint8Array, _p: any, _u: any, topic?: string) => {
    if (topic !== "like") return;
    const txt = new TextDecoder().decode(payload);
    const j = parseMaybeJSON(txt);
    if (j) handleLikeEnvelope(j);
  });

  // إعلان جاهزية لطبقات أخرى
  try { window.dispatchEvent(new Event("like:livekit-bound")); } catch {}
}

function bindDC() {
  try {
    const dc: any = (window as any).__ditonaDataChannel;
    if (!dc?.addEventListener) return;
    if ((window as any).__likeSyncDCBound) return;
    (window as any).__likeSyncDCBound = 1;

    const onMsg = (ev: MessageEvent) => {
      const j = parseMaybeJSON((ev as any)?.data);
      if (j) handleLikeEnvelope(j);
    };
    dc.addEventListener("message", onMsg as any);

    if (typeof dc.setSendGuard === "function") {
      dc.setSendGuard?.(() => {
        const room = (window as any).__lkRoom;
        return !!room && room.state === "connected";
      });
    }

    window.addEventListener(
      "pagehide",
      () => { try { dc.removeEventListener?.("message", onMsg as any); } catch {} },
      { once: true }
    );
  } catch {}
}

(function mount() {
  if (typeof window === "undefined") return;
  if ((window as any).__likeSyncMounted) return;
  (window as any).__likeSyncMounted = 1;

  // ربط LiveKit فور توفّره
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const room: any = (window as any).__lkRoom;
    if (room && room.state) {
      bindLiveKit(room);
      clearInterval(iv);
    }
    if (tries > 100) clearInterval(iv);
  }, 100);

  // أو عند حدث "lk:attached" من ChatClient
  window.addEventListener("lk:attached", () => {
    const room: any = (window as any).__lkRoom;
    bindLiveKit(room);
  }, { passive: true } as any);

  // ربط DC الشيم أيضًا
  bindDC();
})();

export async function likeApiThenDc(forceLiked?: boolean): Promise<{ ok: boolean; duplicate?: boolean }> {
  try {
    const room = (window as any).__lkRoom;
    const pid = currentPair();
    const payload = forceLiked === undefined
      ? { type: "like:toggled" }
      : { t: "like", liked: !!forceLiked, pairId: pid };

    const bin = new TextEncoder().encode(JSON.stringify(payload));
    if (room?.localParticipant?.publishData && room.state === "connected") {
      await room.localParticipant.publishData(bin, { reliable: true, topic: "like" });
      return { ok: true, duplicate: false };
    }

    const dc: any = (window as any).__ditonaDataChannel;
    dc?.send?.(JSON.stringify(payload));
    return { ok: !!dc, duplicate: false };
  } catch {
    return { ok: false, duplicate: false };
  }
}
