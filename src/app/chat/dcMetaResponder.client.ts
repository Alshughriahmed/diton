// src/app/chat/dcMetaResponder.client.ts
"use client";

/**
 * DC → Window bridge for META.
 * يقبل رسائل topic="meta" ويبث ditona:peer-meta بصيغة مفلطحة.
 * يدعم التوافق مع {t:'peer-meta',payload:{...}} و {t:'meta',meta:{...}}.
 * يرد على {t:'meta:init'} بإرسال الميتا المحلية.
 */

type AnyObj = Record<string, any>;

// اسم فريد لتفادي التعارض
function getPairId(): string | null {
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

function flattenMetaPayload(src: AnyObj): AnyObj | null {
  if (!src || typeof src !== "object") return null;

  // توافق قديم
  if (src.t === "peer-meta" && src.payload && typeof src.payload === "object") {
    const d = src.payload || {};
    const pid = d.pairId ?? src.pairId ?? getPairId();
    const meta = d.meta && typeof d.meta === "object" ? d.meta : d;
    return { pairId: pid, ...meta };
  }

  // الصيغ الأساسية: {t:'meta',meta:{...}} أو {meta:{...}}
  const hasMeta = src.meta && typeof src.meta === "object";
  if (hasMeta || src.t === "meta") {
    const pid = src.pairId ?? src.meta?.pairId ?? getPairId();
    const meta = hasMeta ? src.meta : {};
    return { pairId: pid, ...meta };
  }

  return null;
}

function emitPeerMeta(detail: AnyObj) {
  const pidEvt = detail?.pairId;
  const pidNow = getPairId();
  if (pidEvt && pidNow && pidEvt !== pidNow) return; // حارس الزوج
  window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail }));
}

function buildLocalMeta(): AnyObj {
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
    const payload = { t: "meta", pairId: getPairId(), meta: buildLocalMeta() };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" });
  } catch {}
}

function attachRoomForMeta(room: any) {
  if (!room || typeof room?.on !== "function") return;

  const RoomEvent = (globalThis as any).livekit?.RoomEvent;
  const eventName = RoomEvent?.DataReceived || "data-received";

  const onData = (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
    if ((topic || "").toLowerCase() !== "meta") return;
    const j = parseJson(payload);
    if (!j) return;

    if (j.t === "meta:init") {
      publishDCMeta(room);
      return;
    }

    const flat = flattenMetaPayload(j);
    if (flat) emitPeerMeta(flat);
  };

  // منع التكرار
  const handlerKey = "__ditona_meta_onData";
  try {
    const prev = (room as any)[handlerKey];
    if (prev) room.off?.(eventName, prev);
  } catch {}
  room.on(eventName, onData as any);
  (room as any)[handlerKey] = onData;
}

(function boot() {
  // إرفاق فوري إن كانت الغرفة جاهزة
  try {
    const w: any = globalThis as any;
    if (w.__lkRoom) attachRoomForMeta(w.__lkRoom);
  } catch {}

  const onAttached = () => {
    try {
      const w: any = globalThis as any;
      if (w.__lkRoom) attachRoomForMeta(w.__lkRoom);
    } catch {}
  };
  window.addEventListener("lk:attached", onAttached as any, { passive: true } as any);

  const onMetaInit = () => {
    try {
      const w: any = globalThis as any;
      publishDCMeta(w.__lkRoom);
    } catch {}
  };
  window.addEventListener("ditona:meta:init", onMetaInit as any, { passive: true } as any);

  (globalThis as any).__ditonaMetaBridgeCleanup = () => {
    window.removeEventListener("lk:attached", onAttached as any);
    window.removeEventListener("ditona:meta:init", onMetaInit as any);
    try {
      const w: any = globalThis as any;
      const r = w.__lkRoom;
      const RoomEvent = (globalThis as any).livekit?.RoomEvent;
      const eventName = RoomEvent?.DataReceived || "data-received";
      const handlerKey = "__ditona_meta_onData";
      const prev = r?.[handlerKey];
      if (r && prev) r.off?.(eventName, prev);
    } catch {}
  };
})();
