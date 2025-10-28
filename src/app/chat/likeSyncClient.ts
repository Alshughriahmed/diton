// ####  src/app/chat/likeSyncClient.ts
/**
 * تحويل رسائل DC إلى أحداث نافذة:
 *  - {t:"like:sync", count, you, pairId}  ->  "like:sync"  (يجب أن تحمل pairId؛ إن غاب نُلحق الحالي)
 *  - {t:"like", liked}                    ->  "rtc:peer-like" (توافق قديم — لا يُحدّث العداد)
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

function curPairId(): string | null {
  try {
    const w = window as any;
    return (w.__ditonaPairId || w.__pairId || null) as string | null;
  } catch { return null; }
}

function emitLikeSync(p: any) {
  const pid = p?.pairId ?? curPairId();
  if (!pid) return; // يجب أن نحمل pairId دائمًا
  try { window.dispatchEvent(new CustomEvent("like:sync", { detail: { ...p, pairId: pid } })); } catch {}
}
function emitPeerLike(liked: boolean) {
  try { window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked } })); } catch {}
}

/**
 * إرسال نصّي عبر DC تحت topic "like".
 * ملاحظة: لا نرسل قبل اتصال LiveKit "connected".
 */
export async function likeApiThenDc(a?: any): Promise<{ ok: boolean }> {
  try {
    const likedArg = typeof a === "boolean" ? a : undefined;
    const txt = likedArg === undefined
      ? JSON.stringify({ type: "like:toggled" })
      : JSON.stringify({ t: "like", liked: !!likedArg });
    const bin = new TextEncoder().encode(txt);

    const w: any = window as any;
    const room: any = w.__lkRoom;
    const dc: any = w.__ditonaDataChannel;

    // حارس صارم: لا إرسال قبل اتصال فعلي
    if (!room || room.state !== "connected") return { ok: false };

    if (room?.localParticipant?.publishData) {
      await room.localParticipant.publishData(bin, { reliable: true, topic: "like" });
      return { ok: true };
    }
    // مسار احتياطي فقط عند الاتصال؛ وإلا نعيد false أعلاه
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

    // like:sync — المصدر الموثوق لتحديث العدّاد، يجب أن يحمل pairId
    if (j.t === "like:sync" && (typeof j.count === "number" || typeof j.you === "boolean")) {
      const pid = j.pairId ?? curPairId();
      if (!pid) return; // تجاهُل أي رسالة بلا زوج معروف
      emitLikeSync({ count: j.count, you: j.you, pairId: pid });
      return;
    }

    // الشكل القديم — لا يُحدّث العدّاد
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
    // حارس إرسال على مستوى الشيم
    dc?.setSendGuard?.(() => {
      const room: any = w.__lkRoom;
      return !!room && room.state === "connected";
    });
  } catch {}

  window.addEventListener(
    "pagehide",
    () => {
      try { (w.__ditonaDataChannel as any)?.removeEventListener?.("message", onMsg); } catch {}
    },
    { once: true } as any
  );
})();
