// src/app/chat/likeSyncClient.ts
/**
 * مزامنة الإعجاب عبر قناة البيانات + دالة توافقية مع LikeSystem.tsx.
 * تدعم توقيعين:
 *  - likeApiThenDc(liked:boolean)
 *  - likeApiThenDc(pairId:string, dc?:any)  // توقيع قديم
 */

declare global {
  interface Window {
    __likeSyncMounted?: 1;
    __ditonaDataChannel?: {
      addEventListener?: (type: "message", handler: (ev: MessageEvent) => void) => void;
      removeEventListener?: (type: "message", handler: (ev: MessageEvent) => void) => void;
      setSendGuard?: (fn: () => boolean) => void;
      send?: (data: string | ArrayBufferView | ArrayBuffer) => void;
    };
    __lkRoom?: any;
  }
}

function parseJSONFromDC(ev: MessageEvent) {
  const d = ev?.data;
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

/** إرسال إشعار الإعجاب عبر LiveKit أو الشِّيم.
 *  التواقيع المدعومة:
 *    likeApiThenDc(liked:boolean)
 *    likeApiThenDc(pairId:string, dc?:any) // توقيع قديم لا يمرر حالة liked
 */
export async function likeApiThenDc(a?: any, b?: any): Promise<{ ok: boolean; duplicate?: boolean }> {
  try {
    // استنتاج الحقول
    const legacy = typeof a === "string"; // pairId, dc
    const likedArg = !legacy && typeof a === "boolean" ? (a as boolean) : undefined;

    const room = (window as any).__lkRoom;
    const dc = (window as any).__ditonaDataChannel;
    const canUseRoom = !!room && room.state === "connected" && room.localParticipant?.publishData;
    const payloadObj =
      likedArg === undefined
        ? { type: "like:toggled" } // توقيع قديم لا يمرر الحالة
        : { t: "like", liked: !!likedArg };

    const payloadText = JSON.stringify(payloadObj);
    const payloadBin = new TextEncoder().encode(payloadText);

    if (canUseRoom) {
      await room.localParticipant.publishData(payloadBin, { reliable: true, topic: "like" });
      return { ok: true, duplicate: false };
    }
    if (dc?.send) {
      dc.send(payloadText);
      return { ok: true, duplicate: false };
    }
    return { ok: false, duplicate: false };
  } catch {
    return { ok: false, duplicate: false };
  }
}

// مستمع الرسائل الواردة لتحويلها لأحداث UI
if (typeof window !== "undefined" && !window.__likeSyncMounted) {
  window.__likeSyncMounted = 1;

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
    const dc = window.__ditonaDataChannel;
    dc?.addEventListener?.("message", onDCMessage);
    dc?.setSendGuard?.(() => {
      const room = (window as any).__lkRoom;
      return !!room && room.state === "connected";
    });
  } catch {}
}

export {};
