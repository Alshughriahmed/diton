'use client';

import type { Room } from 'livekit-client';
import { RoomEvent } from 'livekit-client';

/**
 * هدف الملف:
 * - ربط RoomEvent.DataReceived بشكل موثوق (على كل المنصات).
 * - دعم كل صيغ meta والـ like المذكورة.
 * - بثّ أحداث موحدة إلى الـHUD:
 *    - 'ditona:peer-meta'  { detail: { pairId, meta } }
 *    - 'like:sync'         { detail: { pairId, count, liked } }
 * - حارس الزوج: إسقاط أي حدث لا يخص window.__ditonaPairId || __pairId.
 * - إرسال 'meta:init' وإعادة إرسال الميتا المحلية عند lk:attached و rtc:pair.
 * - منع التكرار عند إعادة الارتباط/التبديل بين الغرف.
 */

declare global {
  interface Window {
    __lkRoom?: Room | null;
    __ditonaPairId?: string | null;
    __pairId?: string | null;

    // مراجع لمنع التكرار
    __dc_meta_attached?: boolean;
    __dc_meta_handler__?: ((p: Uint8Array, topic?: string) => void) | null;

    // آخر meta محلية معروفة (يُفترض أن metaInit.client يحدّثها)
    __ditonaLocalMeta?: any;

    // لوج مخصص إن موجود
    __dbg_on?: boolean;
  }
}

/* ------------------------------ أدوات مساعدة ------------------------------ */

const td = new TextDecoder();
const te = new TextEncoder();

const log = (...args: any[]) => {
  // فعّل لوج تفصيلي إن رغبت
  if (window?.__dbg_on) console.log('[DC]', ...args);
};

const ev = (name: string, detail?: any) => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const nowPairId = (): string | null =>
  window.__ditonaPairId ?? window.__pairId ?? null;

const samePair = (pid?: string | null): boolean => {
  const cur = nowPairId();
  if (!cur) return true; // إذا لا نعرف الحالي، لا نسقط الحدث
  if (!pid) return true; // إذا المرسل لم يرسل pairId، نقبل (للتوافق)
  return pid === cur;
};

const sendJSON = (room: Room | undefined | null, topic: string, obj: any) => {
  try {
    if (!room?.localParticipant) return;
    const bytes = te.encode(JSON.stringify(obj));
    room.localParticipant.publishData(bytes, { reliable: true, topic });
    log('sent', topic, obj);
  } catch (e) {
    console.warn('[DC] publishData failed:', e);
  }
};

const requestPeerMeta = (room: Room | undefined | null) => {
  const pairId = nowPairId();
  sendJSON(room, 'meta', { t: 'meta:init', pairId });
};

const resendLocalMeta = (room: Room | undefined | null) => {
  // نعتمد على أي مصدر متاح للميتا المحلية
  const meta =
    window.__ditonaLocalMeta ??
    (globalThis as any).__localMeta ??
    (globalThis as any).__meta ??
    null;

  // إذا ما عندنا Meta محلية لا نُرسل شيئًا
  if (!meta) return;

  const pairId = nowPairId();
  sendJSON(room, 'meta', { t: 'meta', pairId, meta });
};

/* --------------------------- تطبيع الرسائل الواردة -------------------------- */

type Normalized =
  | { kind: 'meta'; pairId: string | null; meta: any }
  | { kind: 'like'; pairId: string | null; count: number; liked: boolean }
  | { kind: 'noop' };

function normalizeMessage(obj: any): Normalized {
  if (!obj || typeof obj !== 'object') return { kind: 'noop' };

  const pid = obj.pairId ?? null;

  // like:sync
  if (obj.t === 'like:sync') {
    const liked = typeof obj.liked === 'boolean'
      ? obj.liked
      : !!obj.you; // توافق you→liked
    const count = typeof obj.count === 'number' ? obj.count : 0;
    return { kind: 'like', pairId: pid, count, liked };
  }

  // meta:init → نُعاملها كـ NOOP هنا (الرد يتم خارجيًا عند الاستلام)
  if (obj.t === 'meta:init') {
    return { kind: 'noop' };
  }

  // صيغ meta المتعددة:
  // 1) { t:'meta', pairId?, meta:{...} }
  if (obj.t === 'meta' && obj.meta) {
    return { kind: 'meta', pairId: pid, meta: obj.meta };
  }
  // 2) { pairId?, meta:{...} }
  if (obj.meta && !obj.t) {
    return { kind: 'meta', pairId: pid, meta: obj.meta };
  }
  // 3) { t:'peer-meta', payload:{...} }
  if (obj.t === 'peer-meta' && obj.payload) {
    return { kind: 'meta', pairId: pid, meta: obj.payload };
  }

  // آخر محاولة: إذا بدا أنه meta مباشرة
  if (obj.displayName || obj.gender || obj.country || obj.city) {
    return { kind: 'meta', pairId: pid, meta: obj };
  }

  return { kind: 'noop' };
}

/* ------------------------------ مُعالج البيانات ----------------------------- */

function makeDataHandler(room: Room) {
  // نُخزن المرجع كي نزيله عند إعادة الارتباط
  const handler = (payload: Uint8Array, topic?: string) => {
    let text = '';
    try {
      text = td.decode(payload);
    } catch {
      // إذا لم نستطع فك الترميز، نسقط
      return;
    }

    let obj: any;
    try {
      obj = JSON.parse(text);
    } catch {
      // ليس JSON صالحًا
      return;
    }

    const n = normalizeMessage(obj);

    // حارس الزوج
    if (!samePair((n as any).pairId)) {
      log('drop (pairId mismatch)', n);
      return;
    }

    if (n.kind === 'meta') {
      ev('ditona:peer-meta', { pairId: n.pairId ?? nowPairId(), meta: n.meta });
      log('[EV] ditona:peer-meta', n.meta);
      return;
    }

    if (n.kind === 'like') {
      ev('like:sync', {
        pairId: n.pairId ?? nowPairId(),
        count: n.count,
        liked: n.liked,
      });
      log('[EV] like:sync', { count: n.count, liked: n.liked });
      return;
    }

    // meta:init واردة من الطرف الآخر → نردّ بالميتا المحلية
    if (obj.t === 'meta:init') {
      resendLocalMeta(room);
      return;
    }
  };

  return handler;
}

/* ------------------------------ الربط بالـ Room ----------------------------- */

function attachToRoom(r?: Room | null) {
  if (!r) return;
  // أزل مستمعًا سابقًا إن وُجد
  if (window.__dc_meta_handler__) {
    try {
      r.off(RoomEvent.DataReceived, window.__dc_meta_handler__! as any);
    } catch {}
  }

  const h = makeDataHandler(r);
  r.on(RoomEvent.DataReceived, h as any);
  window.__dc_meta_handler__ = h;
  window.__dc_meta_attached = true;

  log('RoomEvent.DataReceived attached');

  // عند الارتباط نُطلق تبادل meta
  requestPeerMeta(r);
  resendLocalMeta(r);
}

/* ------------------------------- روتين التهيئة ------------------------------ */

function initOnce() {
  if (window.__dc_meta_attached) {
    // سبق التهيئة، لكن لربط الغرف الجديدة نراقب أحداثنا دائمًا
  }

  // 1) إن كان __lkRoom جاهزًا في اللحظة الحالية نرتبط فورًا
  if (window.__lkRoom) attachToRoom(window.__lkRoom);

  // 2) ربط عند lk:attached (ينبّهنا dcShim.client)
  window.addEventListener('lk:attached', () => {
    attachToRoom(window.__lkRoom);
    // نعيد الطلب والإرسال للاحتياط
    requestPeerMeta(window.__lkRoom);
    resendLocalMeta(window.__lkRoom);
  });

  // 3) عند rtc:pair نعيد الطلب/الإرسال (قد يتغير الزوج)
  window.addEventListener('rtc:pair', () => {
    requestPeerMeta(window.__lkRoom);
    resendLocalMeta(window.__lkRoom);
  });

  // 4) قناة مساعدة: أي جزء آخر يريد إجبار إعادة إرسال meta
  window.addEventListener('ditona:send-meta', () => {
    resendLocalMeta(window.__lkRoom);
  });
}

initOnce();
