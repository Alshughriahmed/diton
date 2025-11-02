"use client";

import type { Room } from "livekit-client";
import { RoomEvent } from "livekit-client";

/**
 * DataChannel bridge:
 * - يربط RoomEvent.DataReceived مرة واحدة لكل غرفة.
 * - يطبّع الرسائل إلى:
 *     • 'ditona:peer-meta' { pairId, meta }
 *     • 'like:sync'        { pairId, count, liked }
 * - حارس الزوج: يسقط أحداث pairId غير المطابقة لـ window.__ditonaPairId || __pairId.
 * - يطلب meta من الطرف الآخر ويرسل الميتا المحلية عند: lk:attached, rtc:pair, ditona:send-meta.
 * - «ربط كسول» إذا فاتنا lk:attached.
 */

declare global {
  interface Window {
    __lkRoom?: Room | null;
    __ditonaPairId?: string | null;
    __pairId?: string | null;
    __dc_meta_attached?: boolean;
    __dc_meta_handler__?: ((p: Uint8Array, topic?: string) => void) | null;
    __ditonaLocalMeta?: any;
    __dbg_on?: boolean;
  }
}

const td = new TextDecoder();
const te = new TextEncoder();

const log = (...a: any[]) => {
  if (window?.__dbg_on) console.log("[DC]", ...a);
};

const nowPairId = (): string | null =>
  window.__ditonaPairId ?? window.__pairId ?? null;

const samePair = (pid?: string | null): boolean => {
  const cur = nowPairId();
  if (!cur) return true;
  if (!pid) return true;
  return pid === cur;
};

function sendJSON(room: Room | undefined | null, topic: string, obj: any) {
  try {
    if (!room?.localParticipant) return;
    const bytes = te.encode(JSON.stringify(obj));
    room.localParticipant.publishData(bytes, { reliable: true, topic });
    log("sent", topic, obj);
  } catch (e) {
    console.warn("[DC] publishData failed:", e);
  }
}

function requestPeerMeta(room: Room | undefined | null) {
  const pairId = nowPairId();
  sendJSON(room, "meta", { t: "meta:init", pairId });
}

function resendLocalMeta(room: Room | undefined | null) {
  const meta =
    window.__ditonaLocalMeta ??
    (globalThis as any).__localMeta ??
    (globalThis as any).__meta ??
    null;
  if (!meta) return;
  const pairId = nowPairId();
  sendJSON(room, "meta", { t: "meta", pairId, meta });
}

type Normalized =
  | { kind: "meta"; pairId: string | null; meta: any }
  | { kind: "like"; pairId: string | null; count: number; liked: boolean }
  | { kind: "noop" };

function normalizeMessage(obj: any): Normalized {
  if (!obj || typeof obj !== "object") return { kind: "noop" };
  const pid = obj.pairId ?? null;

  // like:sync {pairId?, count, liked} أو {you}
  if (obj.t === "like:sync") {
    const liked =
      typeof obj.liked === "boolean" ? obj.liked : !!obj.you; // توافق قديم
    const count = typeof obj.count === "number" ? obj.count : 0;
    return { kind: "like", pairId: pid, count, liked };
  }

  if (obj.t === "meta:init") return { kind: "noop" };

  // meta بصيغ متعددة
  if (obj.t === "meta" && obj.meta) return { kind: "meta", pairId: pid, meta: obj.meta };
  if (obj.meta && !obj.t) return { kind: "meta", pairId: pid, meta: obj.meta };
  if (obj.t === "peer-meta" && obj.payload) return { kind: "meta", pairId: pid, meta: obj.payload };

  // محاولة أخيرة
  if (obj.displayName || obj.gender || obj.country || obj.city) {
    return { kind: "meta", pairId: pid, meta: obj };
  }

  return { kind: "noop" };
}

function makeDataHandler(room: Room) {
  const handler = (payload: Uint8Array, _participantTopic?: any, _key?: any, topic?: string) => {
    let text = "";
    try { text = td.decode(payload); } catch { return; }
    let obj: any;
    try { obj = JSON.parse(text); } catch { return; }

    // الرد على meta:init دائمًا
    if (obj?.t === "meta:init") {
      resendLocalMeta(room);
      return;
    }

    const n = normalizeMessage(obj);
    if (!samePair((n as any).pairId)) {
      log("drop (pairId mismatch)", n);
      return;
    }

    if (n.kind === "meta") {
      window.dispatchEvent(new CustomEvent("ditona:peer-meta", {
        detail: { pairId: n.pairId ?? nowPairId(), meta: n.meta },
      }));
      log("[EV] ditona:peer-meta", n.meta);
      return;
    }

    if (n.kind === "like") {
      window.dispatchEvent(new CustomEvent("like:sync", {
        detail: { pairId: n.pairId ?? nowPairId(), count: n.count, liked: n.liked },
      }));
      log("[EV] like:sync", { count: n.count, liked: n.liked });
      return;
    }
  };

  return handler;
}

function attachToRoom(r?: Room | null) {
  if (!r) return;
  // فك مستمع سابق إن وُجد
  if (window.__dc_meta_handler__) {
    try { r.off(RoomEvent.DataReceived, window.__dc_meta_handler__ as any); } catch {}
  }
  const h = makeDataHandler(r);
  r.on(RoomEvent.DataReceived, h as any);
  window.__dc_meta_handler__ = h;
  window.__dc_meta_attached = true;
  log("RoomEvent.DataReceived attached");

  // طلب/إرسال meta فور الارتباط
  requestPeerMeta(r);
  resendLocalMeta(r);
}

/* init + lazy attach */
let __lazy_timer: number | null = null;
let __lazy_tries = 0;

function lazyAttach() {
  if (typeof window === "undefined") return;
  // إذا صار لدينا مستمع فعّال نتوقف
  if (window.__dc_meta_handler__ && typeof window.__dc_meta_handler__ === "function") {
    if (__lazy_timer) { clearInterval(__lazy_timer); __lazy_timer = null; }
    return;
  }
  // جرّب الربط عندما تُصبح __lkRoom جاهزة
  if (window.__lkRoom) {
    attachToRoom(window.__lkRoom);
    if (__lazy_timer) { clearInterval(__lazy_timer); __lazy_timer = null; }
    return;
  }
  if (++__lazy_tries > 20) { // ~10 ثوانٍ عند 500ms
    if (__lazy_timer) { clearInterval(__lazy_timer); __lazy_timer = null; }
  }
}

(function initOnce() {
  // ربط فوري إذا كانت الغرفة جاهزة
  if (window.__lkRoom) attachToRoom(window.__lkRoom);

  // على lk:attached
  window.addEventListener("lk:attached", () => {
    attachToRoom(window.__lkRoom);
    requestPeerMeta(window.__lkRoom);
    resendLocalMeta(window.__lkRoom);
  });

  // عند زوج جديد
  window.addEventListener("rtc:pair", () => {
    requestPeerMeta(window.__lkRoom);
    resendLocalMeta(window.__lkRoom);
  });

  // قناة إجبار إعادة الإرسال
  window.addEventListener("ditona:send-meta", () => {
    resendLocalMeta(window.__lkRoom);
  });

  // مؤقّت «ربط كسول»
  if (!__lazy_timer) __lazy_timer = window.setInterval(lazyAttach, 500);
})();
