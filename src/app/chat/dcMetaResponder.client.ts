"use client";

/**
 * DataChannel → Window Events bridge
 * يطبّع رسائل meta/like القديمة والجديدة ويبث:
 *  - "ditona:peer-meta"  detail={ pairId, meta:{...} }
 *  - "like:sync"         detail={ pairId, count, liked }
 * يحرس بالـ pairId الحالي ويسقط أي حدث لا يطابقه.
 * لا يعتمد على أي حالة React.
 */

import { Room, RoomEvent } from "livekit-client";

type NormObj = Record<string, unknown>;

// helpers بأسماء فريدة لتفادي التعارض
function getPairId_dm(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}
function setPairId_dm(pid: string | null) {
  try {
    const w: any = globalThis as any;
    if (pid) { w.__ditonaPairId = pid; w.__pairId = pid; }
  } catch {}
}
function dispatch(name: string, detail: any) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
}

// تطبيع رسائل meta إلى { pairId, meta:{...} }
function normalizeMeta(payload: any, fallbackPid: string | null) {
  const src: any = payload ?? {};
  // صيغ مقبولة:
  // 1) { t:'meta', pairId, meta:{...} }
  // 2) { pairId, meta:{...} }
  // 3) { t:'peer-meta', payload:{...} }  // قديمة
  // 4) { ...مفلطح فيه حقول meta مباشرة }
  if (src?.t === "peer-meta" && src?.payload) {
    const p = src.payload || {};
    return { pairId: p.pairId || fallbackPid, meta: { ...(p.meta || p) } };
  }
  if (typeof src?.meta === "object") {
    return { pairId: src.pairId || src.meta?.pairId || fallbackPid, meta: { ...(src.meta || {}) } };
  }
  // مفلطح
  const { pairId, ...rest } = src;
  return { pairId: pairId || fallbackPid, meta: { ...rest } };
}

// تطبيع like:sync → { pairId, count, liked }
function normalizeLike(payload: any, fallbackPid: string | null) {
  const src: any = payload ?? {};
  const pid = src.pairId || fallbackPid;
  const count = typeof src.count === "number" ? src.count : undefined;
  const liked = typeof src.liked === "boolean" ? src.liked :
                typeof src.you === "boolean"   ? src.you   : undefined;
  return { pairId: pid, count, liked };
}

// حارس زوج
function isForCurrentPair(pid: string | null) {
  const now = getPairId_dm();
  if (!pid || !now) return true; // اسمح إن لم نعرف
  return pid === now;
}

// مستمع DataReceived واحد فقط
let wired = false;

function wireRoom(room: Room) {
  if (wired || !room) return;
  wired = true;

  room.on(RoomEvent.DataReceived, (bytes: Uint8Array, _p, _cid, topic?: string) => {
    let obj: NormObj | null = null;
    try {
      const txt = new TextDecoder().decode(bytes || new Uint8Array());
      if (txt && /^\s*\{/.test(txt)) obj = JSON.parse(txt) as NormObj;
    } catch { /* ignore */ }

    const fallbackPid = getPairId_dm();

    // meta
    if (topic === "meta" || (obj && (obj as any).t === "meta") || (obj && (obj as any).meta)) {
      const norm = normalizeMeta(obj, fallbackPid);
      if (isForCurrentPair(norm.pairId || null)) {
        dispatch("ditona:peer-meta", { pairId: norm.pairId ?? fallbackPid, meta: norm.meta });
      }
      return;
    }

    // توافق قديم: { t:'peer-meta', payload:{...} }
    if (obj && (obj as any).t === "peer-meta" && (obj as any).payload) {
      const norm = normalizeMeta(obj, fallbackPid);
      if (isForCurrentPair(norm.pairId || null)) {
        dispatch("ditona:peer-meta", { pairId: norm.pairId ?? fallbackPid, meta: norm.meta });
      }
      return;
    }

    // like
    if (topic === "like" || (obj && (obj as any).t === "like:sync") || (obj && (obj as any).type === "like:toggled")) {
      const norm = normalizeLike(obj, fallbackPid);
      if (isForCurrentPair(norm.pairId || null)) {
        dispatch("like:sync", { pairId: norm.pairId ?? fallbackPid, count: norm.count, liked: !!norm.liked });
      }
      return;
    }
  });

  // عند الطلب، أعد بث الميتا المحلية عبر Events؛ إرسال الميتا نفسها تقوم به metaInit.client
  window.addEventListener("ditona:meta:init", () => {
    // لا شيء هنا. مجرد الحفاظ على التوافق إن تم إرسال الحدث.
  });

  // التزامن مع pairId
  window.addEventListener("rtc:pair", (e: any) => {
    const pid = String(e?.detail?.pairId || "") || null;
    if (pid) setPairId_dm(pid);
  });
}

// نقطة دخول: اسلك عند توفر __lkRoom أو عند lk:attached
(function boot() {
  try {
    const w: any = globalThis as any;
    const room: Room | null = w.__lkRoom || null;
    if (room && room.state) wireRoom(room);
  } catch {}

  window.addEventListener("lk:attached", () => {
    try {
      const w: any = globalThis as any;
      const room: Room | null = w.__lkRoom || null;
      if (room) wireRoom(room);
    } catch {}
  }, { once: true });
})();
