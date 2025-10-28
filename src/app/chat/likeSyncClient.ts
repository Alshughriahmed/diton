"use client";

/**
 * جسر رسائل DC/LiveKit إلى أحداث window.
 * - like:sync  -> window "like:sync"
 * - {t:"like", liked} -> window "rtc:peer-like"
 * - {t:"peer-meta", payload} على topic "meta" -> "ditona:peer-meta"
 */

function parseJson(buf: ArrayBuffer | string) {
  try {
    const txt = typeof buf === "string" ? buf : new TextDecoder().decode(buf as ArrayBuffer);
    if (!/^\s*\{/.test(txt)) return null;
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function handle(obj: any, topic?: string) {
  if (!obj) return;

  if (topic === "like" && obj?.t === "like:sync") {
    try { window.dispatchEvent(new CustomEvent("like:sync", { detail: obj })); } catch {}
    return;
  }
  if (topic === "like" && obj?.t === "like" && typeof obj.liked === "boolean") {
    try { window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked: !!obj.liked } })); } catch {}
    return;
  }
  if (topic === "meta" && obj?.t === "peer-meta" && obj?.payload) {
    try { window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: obj.payload })); } catch {}
    return;
  }
}

(function mountOnce() {
  if (typeof window === "undefined") return;
  const w: any = window as any;
  if (w.__likeSyncMounted) return;
  w.__likeSyncMounted = 1;

  function attachRoom(room: any) {
    if (!room || room.__likeSyncHooked) return;
    room.__likeSyncHooked = 1;
    try {
      room.on?.("dataReceived", (p: ArrayBuffer, _1: any, _2: any, topic?: string) => {
        const j = parseJson(p);
        handle(j, topic);
      });
    } catch {}
  }

  // حاول الآن، ثم عند "lk:attached"
  try { attachRoom(w.__lkRoom); } catch {}
  window.addEventListener("lk:attached", () => { try { attachRoom((window as any).__lkRoom); } catch {} }, { passive: true } as any);

  // دعم الشِّيم إن وُجد
  try {
    const dc = w.__ditonaDataChannel;
    dc?.addEventListener?.("message", (ev: MessageEvent) => {
      const data = (ev as any)?.data;
      const j = typeof data === "string" ? parseJson(data) :
                data instanceof ArrayBuffer ? parseJson(data) :
                (ArrayBuffer.isView(data) ? parseJson((data as any).buffer) : null);
      // لا يوجد topic مع الشيم، فمرّر حسب الشكل فقط
      if (j?.t === "like:sync") handle(j, "like");
      else if (j?.t === "like") handle(j, "like");
      else if (j?.t === "peer-meta") handle(j, "meta");
    });
    // حارس إرسال في الشيم
    dc?.setSendGuard?.(() => {
      const room = (window as any).__lkRoom;
      return !!room && room.state === "connected";
    });
  } catch {}
})();
