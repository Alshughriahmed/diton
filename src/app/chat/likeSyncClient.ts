// src/app/chat/likeSyncClient.ts
/**
 * مزامنة الإعجاب عبر قناة البيانات + دالة توافقية مع LikeSystem.tsx.
 * يدعم:
 *  - likeApiThenDc(liked:boolean)
 *  - likeApiThenDc(pairId:string, dc?:any)  // توقيع قديم
 */

// لا نعلن أنواع نافذة صارمة لتفادي تعارضات مع الشيم
// نستعمل (window as any) فقط.

function parseJSONFromDC(ev: MessageEvent) {
  const d = (ev as any)?.data;
  let s: string | null = null;
  if (typeof d === "string") s = d;
  else if (d instanceof ArrayBuffer) s = new TextDecoder().decode(new Uint8Array(d));
  else if (ArrayBuffer.isView(d)) s = new TextDecoder().decode(d as any);
  if (!s || !/^\s*\{/.test(s)) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function emitPeerLike(liked: boolean) {
  try {
    window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked } }));
    window.dispatchEvent(new CustomEvent("ditona:like:recv", { detail: { liked } }));
  } catch {}
}

/** إرسال إشعار الإعجاب عبر LiveKit أو الشِّيم. */
export async function likeApiThenDc(a?: any, _b?: any): Promise<{ ok: boolean; duplicate?: boolean }> {
  try {
    const legacy = typeof a === "string"; // pairId, dc (غير مستخدمين فعليًا هنا)
    const likedArg = !legacy && typeof a === "boolean" ? (a as boolean) : undefined;

    const room = (window as any).__lkRoom;
    const dc = (window as any).__ditonaDataChannel;

    const payloadObj =
      likedArg === undefined ? { type: "like:toggled" } : { t: "like", liked: !!likedArg };
    const payloadTxt = JSON.stringify(payloadObj);
    const payloadBin = new TextEncoder().encode(payloadTxt);

    if (room && room.state === "connected" && room.localParticipant?.publishData) {
      await room.localParticipant.publishData(payloadBin, { reliable: true, topic: "like" });
      return { ok: true, duplicate: false };
    }
    if (dc?.send) {
      dc.send(payloadTxt);
      return { ok: true, duplicate: false };
    }
    return { ok: false, duplicate: false };
  } catch {
    return { ok: false, duplicate: false };
  }
}

// مستمع الرسائل الواردة لتحويلها لأحداث UI
(function mountOnce() {
  const w = window as any;
  if (typeof window === "undefined") return;
  if (w.__likeSyncMounted) return;
  w.__likeSyncMounted = 1;

  const onDCMessage = (ev: MessageEvent) => {
    const j = parseJSONFromDC(ev);
    if (!j) return;
    if (j?.t === "like" && typeof j.liked === "boolean") {
      emitPeerLike(!!j.liked);
    } else if (j?.type === "like:toggled" && j?.payload && typeof j.payload.liked === "boolean") {
      emitPeerLike(!!j.payload.liked);
    }
  };

  try {
    const dc = (window as any).__ditonaDataChannel;
    dc?.addEventListener?.("message", onDCMessage);
    dc?.setSendGuard?.(() => {
      const room = (window as any).__lkRoom;
      return !!room && room.state === "connected";
    });
  } catch {}

  window.addEventListener(
    "pagehide",
    () => {
      try {
        const dc = (window as any).__ditonaDataChannel;
        dc?.removeEventListener?.("message", onDCMessage);
      } catch {}
    },
    { once: true }
  );
})();
