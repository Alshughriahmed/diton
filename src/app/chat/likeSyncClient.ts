// src/app/chat/likeSyncClient.ts
/**
 * إرسال/استقبال رسائل اللايك. يدعم LiveKit + الشيم.
 */
function emit(name: string, detail: any) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
}

function parse(b: ArrayBuffer | Uint8Array | string) {
  try {
    if (typeof b === "string") return JSON.parse(b);
    const u8 = b instanceof Uint8Array ? b : new Uint8Array(b as ArrayBuffer);
    return JSON.parse(new TextDecoder().decode(u8));
  } catch { return null; }
}

/** إرسال فقط، لا يعيد بث محلي لتفادي الحلقات. */
export async function likeApiThenDc(liked?: boolean): Promise<{ ok: boolean }> {
  try {
    const room: any = (window as any).__lkRoom;
    const dc: any = (window as any).__ditonaDataChannel;

    const msg = liked === undefined ? { type: "like:toggled" } : { t: "like", liked: !!liked };
    const bin = new TextEncoder().encode(JSON.stringify(msg));

    if (room?.state === "connected" && room.localParticipant?.publishData) {
      await room.localParticipant.publishData(bin, { reliable: true, topic: "like" });
      return { ok: true };
    }
    if (dc?.send) { dc.send(JSON.stringify(msg)); return { ok: true }; }
    return { ok: false };
  } catch { return { ok: false }; }
}

/* استقبال رسائل LiveKit والشيم → أحداث واجهة */
(function mountOnce() {
  const w: any = window as any;
  if (typeof window === "undefined" || w.__likeSyncMounted) return;
  w.__likeSyncMounted = 1;

  // من الشيم
  try {
    const dc: any = w.__ditonaDataChannel;
    dc?.addEventListener?.("message", (ev: MessageEvent) => {
      const j = parse((ev as any).data);
      if (!j) return;
      if (j.t === "like:sync") emit("like:sync", { count: j.count, you: j.you, pairId: j.pairId });
      else if (j.t === "like" && typeof j.liked === "boolean") emit("rtc:peer-like", { liked: !!j.liked });
    });
  } catch {}

  // من LiveKit
  const room: any = w.__lkRoom;
  room?.on?.("dataReceived", (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
    if (topic !== "like") return;
    const j = parse(payload);
    if (!j) return;
    if (j.t === "like:sync") emit("like:sync", { count: j.count, you: j.you, pairId: j.pairId });
    else if (j.t === "like" && typeof j.liked === "boolean") emit("rtc:peer-like", { liked: !!j.liked });
  });
})();
