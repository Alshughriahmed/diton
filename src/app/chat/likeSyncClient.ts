/**
 * تحويل رسائل DC إلى أحداث نافذة:
 *  - {t:"like:sync", count, you, pairId}  ->  "like:sync"
 *  - {t:"like", liked}                    ->  "rtc:peer-like" (توافق قديم)
 * ويوفّر likeApiThenDc() للإرسال عبر DC عند الحاجة.
 */

function parse(ev: MessageEvent): any | null {
  const d: any = (ev as any).data;
  let s: string | null = null;
  if (typeof d === "string") s = d;
  else if (d instanceof ArrayBuffer) s = new TextDecoder().decode(new Uint8Array(d));
  else if (ArrayBuffer.isView(d)) s = new TextDecoder().decode(d as any);
  if (!s || !/^\s*\{/.test(s)) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function emitLikeSync(p: any) {
  try { window.dispatchEvent(new CustomEvent("like:sync", { detail: p })); } catch {}
}
function emitPeerLike(liked: boolean) {
  try { window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked } })); } catch {}
}

export async function likeApiThenDc(a?: any): Promise<{ ok: boolean }> {
  try {
    const likedArg = typeof a === "boolean" ? a : undefined;
    const txt = likedArg === undefined
      ? JSON.stringify({ type: "like:toggled" })
      : JSON.stringify({ t: "like", liked: !!likedArg });
    const bin = new TextEncoder().encode(txt);

    const room: any = (window as any).__lkRoom;
    const dc: any = (window as any).__ditonaDataChannel;

    if (room?.state === "connected" && room?.localParticipant?.publishData) {
      await room.localParticipant.publishData(bin, { reliable: true, topic: "like" });
      return { ok: true };
    }
    if (dc?.send) { dc.send(txt); return { ok: true }; }
    return { ok: false };
  } catch { return { ok: false }; }
}

// mount once
(() => {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__likeSyncMounted) return;
  w.__likeSyncMounted = 1;

  const onMsg = (ev: MessageEvent) => {
    const j = parse(ev);
    if (!j) return;

    if (j.t === "like:sync" && (typeof j.count === "number" || typeof j.you === "boolean")) {
      emitLikeSync({ count: j.count, you: j.you, pairId: j.pairId });
      return;
    }
    if (j.t === "like" && typeof j.liked === "boolean") {
      emitPeerLike(!!j.liked);
      return;
    }
    if (j.type === "like:toggled" && j?.payload && typeof j.payload.liked === "boolean") {
      emitPeerLike(!!j.payload.liked);
    }
  };

  try {
    const dc: any = w.__ditonaDataChannel;
    dc?.addEventListener?.("message", onMsg);
    dc?.setSendGuard?.(() => {
      const room: any = w.__lkRoom;
      return !!room && room.state === "connected";
    });
  } catch {}

  window.addEventListener("pagehide", () => {
    try { (w.__ditonaDataChannel as any)?.removeEventListener?.("message", onMsg); } catch {}
  }, { once: true } as any);
})();
