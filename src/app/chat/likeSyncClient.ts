"use client";

/**
 * مزامنة الإعجاب عبر قناتي LiveKit وDC الشيم.
 * - يمرّر رسائل like:sync الواردة إلى window: "like:sync".
 * - يحوّل رسائل {t:"like", liked:boolean} القديمة إلى "rtc:peer-like".
 * - يوفّر likeApiThenDc() للإرسال السريع عبر البيانات إن لزم.
 */

function parseJSONFromUnknown(evData: any): any | null {
  try {
    if (typeof evData === "string") return JSON.parse(evData);
    if (evData instanceof ArrayBuffer) {
      return JSON.parse(new TextDecoder().decode(new Uint8Array(evData)));
    }
    if (ArrayBuffer.isView(evData)) {
      return JSON.parse(new TextDecoder().decode(evData as any));
    }
  } catch {}
  return null;
}

function emitLikeSync(payload: any) {
  try {
    window.dispatchEvent(new CustomEvent("like:sync", { detail: payload }));
  } catch {}
}

function emitPeerLike(liked: boolean) {
  try {
    window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked } }));
    window.dispatchEvent(new CustomEvent("ditona:like:recv", { detail: { liked } }));
  } catch {}
}

/** إرسال خفيف عبر قناة البيانات فقط. لا يتعامل مع الـAPI. */
export async function likeApiThenDc(a?: any, _b?: any): Promise<{ ok: boolean; duplicate?: boolean }> {
  try {
    const likedArg = typeof a === "boolean" ? (a as boolean) : undefined;
    const room: any = (window as any).__lkRoom;
    const dc: any = (window as any).__ditonaDataChannel;

    const obj = likedArg === undefined ? { type: "like:toggled" } : { t: "like", liked: !!likedArg };
    const txt = JSON.stringify(obj);
    const bin = new TextEncoder().encode(txt);

    if (room?.state === "connected" && room?.localParticipant?.publishData) {
      await room.localParticipant.publishData(bin, { reliable: true, topic: "like" });
      return { ok: true, duplicate: false };
    }
    if (dc?.send) {
      dc.send(txt);
      return { ok: true, duplicate: false };
    }
    return { ok: false, duplicate: false };
  } catch {
    return { ok: false, duplicate: false };
  }
}

// mount once
(() => {
  if (typeof window === "undefined") return;
  const w: any = window as any;
  if (w.__likeSyncMounted) return;
  w.__likeSyncMounted = 1;

  // DC shim listener
  try {
    const dc: any = w.__ditonaDataChannel;
    const onMsg = (ev: MessageEvent) => {
      const j = parseJSONFromUnknown((ev as any)?.data);
      if (!j) return;
      if (j?.t === "like" && typeof j.liked === "boolean") {
        emitPeerLike(!!j.liked);
        return;
      }
      if (j?.t === "like:sync" && (typeof j.count === "number" || typeof j.you === "boolean")) {
        emitLikeSync({ count: j.count, you: j.you, pairId: j.pairId });
      }
      if (j?.type === "like:toggled" && j?.payload && typeof j.payload.liked === "boolean") {
        emitPeerLike(!!j.payload.liked);
      }
    };
    dc?.addEventListener?.("message", onMsg);
    dc?.setSendGuard?.(() => {
      const room: any = (window as any).__lkRoom;
      return !!room && room.state === "connected";
    });
    window.addEventListener(
      "pagehide",
      () => {
        try {
          dc?.removeEventListener?.("message", onMsg);
        } catch {}
      },
      { once: true }
    );
  } catch {}

  // LiveKit topic listener
  try {
    const room: any = w.__lkRoom;
    if (room?.on) {
      room.on("dataReceived", (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
        if (topic !== "like") return;
        const j = parseJSONFromUnknown(payload);
        if (!j) return;
        if (j?.t === "like" && typeof j.liked === "boolean") {
          emitPeerLike(!!j.liked);
          return;
        }
        if (j?.t === "like:sync" && (typeof j.count === "number" || typeof j.you === "boolean")) {
          emitLikeSync({ count: j.count, you: j.you, pairId: j.pairId });
        }
      });
    }
  } catch {}
})();
