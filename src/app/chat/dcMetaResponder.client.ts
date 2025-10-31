// src/app/chat/dcMetaResponder.client.ts
"use client";

/**
 * DC → Window bridge for META.
 * يقبل: {t:"meta", meta:{...}}, {meta:{...}}, {t:"peer-meta",payload:{...}}, {t:"meta:init"}
 * يَبثّ دائمًا:  window.dispatchEvent(new CustomEvent("ditona:peer-meta",{detail:{pairId,...}}))
 * ويرد على "meta:init" ببث الميتا المحلية عبر الـDC.
 * لا تبعيات ولا ENV.
 */

type AnyObj = Record<string, any>;

/* === pairId helper باسم فريد لتفادي التعارض مع ملفات أخرى === */
function getPairId_dm(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

function parseJson_dm(bytes: Uint8Array | string): AnyObj | null {
  try {
    const s = typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes);
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* === تسطيح صيغ الميتا إلى detail موحّد === */
function flattenMetaPayload_dm(src: AnyObj): AnyObj | null {
  if (!src || typeof src !== "object") return null;

  // توافق قديم: { t:'peer-meta', payload:{...} }
  if (src.t === "peer-meta" && src.payload && typeof src.payload === "object") {
    const d = src.payload || {};
    const pid = d.pairId ?? src.pairId ?? getPairId_dm();
    const meta = d.meta && typeof d.meta === "object" ? d.meta : d;
    return { pairId: pid, ...meta };
  }

  // الصيغ الأساسية: { t:'meta', pairId?, meta:{...} } أو { pairId?, meta:{...} }
  const hasMeta = src.meta && typeof src.meta === "object";
  if (hasMeta || src.t === "meta") {
    const pid = src.pairId ?? src.meta?.pairId ?? getPairId_dm();
    const meta = hasMeta ? src.meta : {};
    return { pairId: pid, ...meta };
  }

  return null;
}

/* === بثّ الحدث الموحّد مع حارس الزوج === */
function emitPeerMeta_dm(detail: AnyObj) {
  const pidEvt = detail?.pairId;
  const pidNow = getPairId_dm();
  if (pidEvt && pidNow && pidEvt !== pidNow) return; // إسقاط أحداث زوج قديم
  window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail }));
}

/* === بناء ميتا محلية لإرسالها للطرف الآخر عند الطلب === */
function buildLocalMeta_dm(): AnyObj {
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

function publishDCMeta_dm(room: any) {
  try {
    if (!room) return;
    const payload = { t: "meta", pairId: getPairId_dm(), meta: buildLocalMeta_dm() };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" });
  } catch {}
}

/* === إرفاق مستمع DC مع منع التكرار وإرسال meta:init فورًا === */
function attachRoomForMeta_dm(room: any) {
  if (!room || typeof room?.on !== "function") return;

  const RoomEvent = (globalThis as any).livekit?.RoomEvent;
  const eventName = RoomEvent?.DataReceived || "data-received";

  const onData = (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
    const j = parseJson_dm(payload);
    if (!j) return;

    // لا نعتمد على topic فقط. نحدّد رسائل meta من المحتوى أيضًا.
    const topicIsMeta = (topic || "").toLowerCase() === "meta";
    const looksLikeMeta =
      j?.t === "meta" || j?.t === "peer-meta" || j?.t === "meta:init" || (j && typeof j.meta === "object");
    if (!(topicIsMeta || looksLikeMeta)) return;

    if (j.t === "meta:init") {
      publishDCMeta_dm(room); // ردّ بالميتا المحلية
      return;
    }

    const flat = flattenMetaPayload_dm(j);
    if (flat) emitPeerMeta_dm(flat);
  };

  // منع تكرار المستمع
  const handlerKey = "__ditona_meta_onData";
  try {
    const prev = (room as any)[handlerKey];
    if (prev) room.off?.(eventName, prev);
  } catch {}
  room.on(eventName, onData as any);
  (room as any)[handlerKey] = onData;

  // اطلب ميتا الطرف فور الارتباط
  try {
    const bytes = new TextEncoder().encode(JSON.stringify({ t: "meta:init", pairId: getPairId_dm() }));
    room?.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" });
    setTimeout(() => {
      try {
        room?.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" });
      } catch {}
    }, 250);
  } catch {}
}

/* === إقلاع وربط عند جاهزية الغرفة أو حدث lk:attached === */
(function boot_dm() {
  try {
    const w: any = globalThis as any;
    if (w.__lkRoom) attachRoomForMeta_dm(w.__lkRoom);
  } catch {}

  const onAttached = () => {
    try {
      const w: any = globalThis as any;
      if (w.__lkRoom) attachRoomForMeta_dm(w.__lkRoom);
    } catch {}
  };
  window.addEventListener("lk:attached", onAttached as any, { passive: true } as any);

  // منظّف اختياري
  (globalThis as any).__ditonaMetaBridgeCleanup = () => {
    window.removeEventListener("lk:attached", onAttached as any);
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
