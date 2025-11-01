'use client';

import type { Room } from 'livekit-client';
import { RoomEvent } from 'livekit-client';

/**
 * الهدف:
 * - استقبال كل صيغ meta/like عبر DataChannel وتوحيدها.
 * - بث أحداث موحّدة:
 *    • 'ditona:peer-meta' { detail: { pairId, meta } }
 *    • 'like:sync'        { detail: { pairId, count, liked } }
 * - حارس الزوج pairId، مع توافق عند غيابه.
 * - إرسال 'meta:init' و(إعادة) إرسال الميتا المحلية عند lk:attached و rtc:pair.
 * - منع التكرار عبر الغرف (detach من الغرفة السابقة قبل attach الجديدة).
 */

declare global {
  interface Window {
    __lkRoom?: Room | null;
    __ditonaPairId?: string | null;
    __pairId?: string | null;

    // مراجع لمنع التكرار وعبر الغرف
    __dc_meta_attached?: boolean;
    __dc_meta_handler__?: ((p: Uint8Array, topic?: string) => void) | null;
    __dc_meta_room__?: Room | null;

    // آخر meta محلية معروفة (تُحدَّث من metaInit.client)
    __ditonaLocalMeta?: any;

    // لوج تفصيلي اختياري
    __dbg_on?: boolean;

    // منع فيض إعادة الإرسال
    __dc_meta_last_resend_at__?: number;
  }
}

/* ------------------------------ أدوات مساعدة ------------------------------ */

const td = new TextDecoder();
const te = new TextEncoder();

const log = (...args: any[]) => {
  if (window?.__dbg_on) console.log('[DC]', ...args);
};

const ev = (name: string, detail?: any) => {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
};

const nowPairId = (): string | null =>
  window.__ditonaPairId ?? window.__pairId ?? null;

const samePair = (pid?: string | null): boolean => {
  const cur = nowPairId();
  if (!cur) return true; // لا نعرف الحالي → نقبل للتوافق
  if (!pid) return true; // المرسل لم يُضمّن pairId → نقبل للتوافق
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

const safeResendLocalMeta = (room: Room | undefined | null, throttleMs = 300) => {
  const meta =
    window.__ditonaLocalMeta ??
    (globalThis as any).__localMeta ??
    (globalThis as any).__meta ??
    null;

  if (!meta) return;

  const now = Date.now();
  const last = window.__dc_meta_last_resend_at__ || 0;
  if (now - last < throttleMs) return;
  window.__dc_meta_last_resend_at__ = now;

  const pairId = nowPairId();
  sendJSON(room, 'meta', { t: 'meta', pairId, meta });
};

/* --------------------------- تطبيع الرسائل الواردة -------------------------- */

type Normalized =
  | { kind: 'meta'; pairId: string | null; meta: any }
  | { kind: 'like'; pairId: string | null; count: number; liked: boolean }
  | { kind: 'noop' };

function normalizeMessage(obj: any, topic?: string): Normalized {
  if (!obj || typeof obj !== 'object') return { kind: 'noop' };

  const pid = obj.pairId ?? null;

  // like (سواء topic==='like' أو t==='like:sync')
  if (topic === 'like' || obj.t === 'like:sync') {
    const liked = typeof obj.liked === 'boolean' ? obj.liked : !!obj.you; // you→liked توافقًا
    const count = typeof obj.count === 'number' ? obj.count : 0;
    return { kind: 'like', pairId: pid, count, liked };
  }

  // meta:init → نتعامل معها خارجًا (إجابة الميتا)
  if (obj.t === 'meta:init') {
    return { kind: 'noop' };
  }

  // صيغ meta المتعددة (مع أو بدون topic==='meta')
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

  // 4) topic === 'meta' ومع حمولة تبدو meta مباشرة
  if (topic === 'meta' && (obj.displayName || obj.gender || obj.country || obj.city || obj.vip || obj.likes)) {
    return { kind: 'meta', pairId: pid, meta: obj };
  }

  // محاولة أخيرة: إذا بدا أنها meta مباشرة
  if (obj.displayName || obj.gender || obj.country || obj.city) {
    return { kind: 'meta', pairId: pid, meta: obj };
  }

  return { kind: 'noop' };
}

/* ------------------------------ مُعالج البيانات ----------------------------- */

function makeDataHandler(room: Room) {
  const handler = (payload: Uint8Array, _p?: any, _k?: any, topic?: string) => {
    let obj: any = null;
    try {
      const text = td.decode(payload);
      obj = JSON.parse(text);
    } catch {
      return; // ليس JSON صالحًا
    }

    // meta:init واردة من الطرف الآخر → نردّ بالميتا المحلية
    if (obj?.t === 'meta:init' || topic === 'meta' && obj?.t === 'meta:init') {
      safeResendLocalMeta(room);
      return;
    }

    const n = normalizeMessage(obj, topic);

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
  };

  return handler;
}

/* ------------------------------ الربط بالـ Room ----------------------------- */

function attachToRoom(r?: Room | null) {
  if (!r) return;

  // فكّ الارتباط من الغرفة السابقة إن وُجدت
  const prevRoom = window.__dc_meta_room__;
  if (prevRoom && window.__dc_meta_handler__) {
    try { prevRoom.off(RoomEvent.DataReceived, window.__dc_meta_handler__ as any); } catch {}
  }

  // إزالة أي مستمع مركّب على هذه الغرفة بنفس المرجع (للأمان)
  if (window.__dc_meta_handler__) {
    try { r.off(RoomEvent.DataReceived, window.__dc_meta_handler__ as any); } catch {}
  }

  const h = makeDataHandler(r);
  r.on(RoomEvent.DataReceived, h as any);
  window.__dc_meta_handler__ = h;
  window.__dc_meta_attached = true;
  window.__dc_meta_room__ = r;

  log('RoomEvent.DataReceived attached');

  // عند الارتباط: نطلق تبادل meta
  requestPeerMeta(r);
  safeResendLocalMeta(r);
  // نبضة احتياطية بعد 250ms (تحسُّبًا للتزامن)
  setTimeout(() => safeResendLocalMeta(r), 250);
}

/* ------------------------------- روتين التهيئة ------------------------------ */

function initOnce() {
  // 1) إن كان __lkRoom جاهزًا الآن
  if (window.__lkRoom) attachToRoom(window.__lkRoom);

  // 2) عند lk:attached (dcShim.client)
  window.addEventListener('lk:attached', () => {
    attachToRoom(window.__lkRoom);
    requestPeerMeta(window.__lkRoom);
    safeResendLocalMeta(window.__lkRoom);
    setTimeout(() => safeResendLocalMeta(window.__lkRoom), 250);
  });

  // 3) عند rtc:pair (تغيّر الزوج)
  window.addEventListener('rtc:pair', () => {
    requestPeerMeta(window.__lkRoom);
    safeResendLocalMeta(window.__lkRoom);
    setTimeout(() => safeResendLocalMeta(window.__lkRoom), 250);
  });

  // 4) قناة مساعدة لإجبار إعادة إرسال meta
  window.addEventListener('ditona:send-meta', () => {
    safeResendLocalMeta(window.__lkRoom);
  });
}

initOnce();
