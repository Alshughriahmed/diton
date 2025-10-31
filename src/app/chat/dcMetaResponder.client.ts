// src/app/chat/dcMetaResponder.client.ts
"use client";

/**
 * DC → Window bridge for META.
 *
 * يقبل الرسائل التالية على topic="meta":
 *   1) { t:"meta", pairId?, meta:{...} }
 *   2) { pairId?, meta:{...} }
 *   3) { t:"peer-meta", payload:{...} }   // توافق قديم
 *   4) { t:"meta:init" }                  // طلب الميتا المحلية
 *
 * وينتِج دائمًا حدث نافذة موحد:
 *   window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: {
 *     pairId, displayName?, vip?, likes?, country?, city?, gender?, avatarUrl?
 *   }}));
 *
 * كما يستجيب لطلب "meta:init" ببث ميتا محلية إلى الطرف الآخر:
 *   publishDC({ t:"meta", pairId, meta:{...} }, topic="meta")
 *
 * لا تبعيات. لا ENV جديدة.
 */

type AnyObj = Record<string, any>;

function curPair(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

function parseJson(bytes: Uint8Array | string): AnyObj | null {
  try {
    const s = typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes);
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function flattenMeta(src: AnyObj): AnyObj | null {
  if (!src || typeof src !== "object") return null;

  // توافق قديم: { t:'peer-meta', payload:{...} }
  if (src.t === "peer-meta" && src.payload && typeof src.payload === "object") {
    const d = src.payload || {};
    const pid = d.pairId ?? src.pairId ?? curPair();
    const meta = d.meta && typeof d.meta === "object" ? d.meta : d;
    return { pairId: pid, ...meta };
  }

  // الصيغ الأساسية: { t:'meta', pairId?, meta:{...} } أو { pairId?, meta:{...} }
  const hasMeta = src.meta && typeof src.meta === "object";
  if (hasMeta || src.t === "meta") {
    const pid = src.pairId ?? src.meta?.pairId ?? curPair();
    const meta = hasMeta ? src.meta : {};
    return { pairId: pid, ...meta };
  }

  return null;
}

function publishWindowPeerMeta(detail: AnyObj) {
  const pidEvt = detail?.pairId;
  const pidNow = curPair();
  if (pidEvt && pidNow && pidEvt !== pidNow) return; // حارس الزوج
  window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail }));
}

function buildLocalMeta(): AnyObj {
  // نحاول جمع الميتا المحلية دون تبعيات
  // 1) من Zustand persist إن وُجد
  let gender: string | undefined;
  let displayName: string | undefined;
  let avatarUrl: string | undefined;
  let vip: boolean | undefined;
  try {
    const raw = localStorage.getItem("ditona.profile.v1");
    if (raw) {
      const j = JSON.parse(raw);
      gender = j?.state?.profile?.gender ?? j?.profile?.gender;
      displayName = j?.state?.profile?.displayName ?? j?.profile?.displayName;
      avatarUrl = j?.state?.profile?.avatarUrl ?? j?.profile?.avatarUrl;
      vip = !!(j?.state?.profile?.vip ?? j?.profile?.vip);
    }
  } catch {}

  // 2) من الموقع الجغرافي المخزّن
  let country: string | undefined;
  let city: string | undefined;
  try {
    const geo = JSON.parse(localStorage.getItem("ditona_geo") || "null");
    const cc = (geo?.countryCode || geo?.country || "").toString().toUpperCase();
    country = cc || undefined;
    city = (geo?.city || undefined) as string | undefined;
  } catch {}

  return { gender, displayName, avatarUrl, vip, country, city };
}

function publishDCMeta(room: any) {
  try {
    if (!room) return;
    const payload = {
      t: "meta",
      pairId: curPair(),
      meta: buildLocalMeta(),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" });
  } catch {}
}

function attachRoom(room: any) {
  if (!room || typeof room?.on !== "function") return;

  const RoomEvent = (globalThis as any).livekit?.RoomEvent;
  const eventName = RoomEvent?.DataReceived || "data-received";

  const onData = (payload: Uint8Array, _participant: any, _kind: any, topic?: string) => {
    if ((topic || "").toLowerCase() !== "meta") return;
    const j = parseJson(payload);
    if (!j) return;

    // إن كان طلب meta:init من الطرف الآخر نرد بميتا محلية
    if (j.t === "meta:init") {
      publishDCMeta(room);
      return;
    }

    const flat = flattenMeta(j);
    if (flat) publishWindowPeerMeta(flat);
  };

  // منع التكرار
  const key = "__ditona_meta_onData";
  try {
    const prev = (room as any)[key];
    if (prev) room.off?.(eventName, prev);
  } catch {}
  room.on(eventName, onData as any);
  (room as any)[key] = onData;
}

(function boot() {
  // attach فورًا إن كان __lkRoom جاهزًا
  try {
    const w: any = globalThis as any;
    if (w.__lkRoom) attachRoom(w.__lkRoom);
  } catch {}

  // عند ارتباط LiveKit لاحقًا
  const onAttached = () => {
    try {
      const w: any = globalThis as any;
      if (w.__lkRoom) attachRoom(w.__lkRoom);
    } catch {}
  };
  window.addEventListener("lk:attached", onAttached as any, { passive: true } as any);

  // استقبال طلب داخلي لإرسال الميتا المحلية إلى الطرف الآخر
  const onMetaInit = () => {
    try {
      const w: any = globalThis as any;
      publishDCMeta(w.__lkRoom);
    } catch {}
  };
  window.addEventListener("ditona:meta:init", onMetaInit as any, { passive: true } as any);

  // تنظيف اختياري
  (globalThis as any).__ditonaMetaBridgeCleanup = () => {
    window.removeEventListener("lk:attached", onAttached as any);
    window.removeEventListener("ditona:meta:init", onMetaInit as any);
    try {
      const w: any = globalThis as any;
      const r = w.__lkRoom;
      const RoomEvent = (globalThis as any).livekit?.RoomEvent;
      const eventName = RoomEvent?.DataReceived || "data-received";
      const key = "__ditona_meta_onData";
      const prev = r?.[key];
      if (r && prev) r.off?.(eventName, prev);
    } catch {}
  };
})();
