// src/app/chat/dcMetaResponder.client.ts
"use client";

/**
 * DC → Window bridge for META.
 * يقبل: {t:"meta", meta:{...}}, {meta:{...}}, {t:"peer-meta",payload:{...}}, {t:"meta:init"}
 * يبث دائمًا:  window.dispatchEvent(new CustomEvent("ditona:peer-meta",{detail:{pairId,...}}))
 * ويرد على "meta:init" بإرسال الميتا المحلية عبر الـDC.
 * لا ENV ولا تبعيات.
 */

/* === أسماء فريدة لتفادي التعارض === */
type DitonaAny_dm = Record<string, any>;

function pid_dm(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

function parse_dm(bytes: Uint8Array | string): DitonaAny_dm | null {
  try {
    const s = typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes);
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* === تسطيح صيغ الميتا إلى detail موحّد === */
function flatMeta_dm(src: DitonaAny_dm): DitonaAny_dm | null {
  if (!src || typeof src !== "object") return null;

  // توافق قديم: { t:'peer-meta', payload:{...} }
  if (src.t === "peer-meta" && src.payload && typeof src.payload === "object") {
    const d = src.payload || {};
    const pid = d.pairId ?? src.pairId ?? pid_dm();
    const meta = d.meta && typeof d.meta === "object" ? d.meta : d;
    return { pairId: pid, ...meta };
  }

  // الصيغ الأساسية: { t:'meta', pairId?, meta:{...} } أو { pairId?, meta:{...} }
  const hasMeta = src.meta && typeof src.meta === "object";
  if (hasMeta || src.t === "meta") {
    const pid = src.pairId ?? src.meta?.pairId ?? pid_dm();
    const meta = hasMeta ? src.meta : {};
    return { pairId: pid, ...meta };
  }

  return null;
}

/* === بثّ الحدث الموحّد مع حارس الزوج === */
function emitPeer_dm(detail: DitonaAny_dm) {
  const ePid = detail?.pairId;
  const now = pid_dm();
  if (ePid && now && ePid !== now) return; // إسقاط أحداث زوج قديم
  window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail }));
}

/* === بناء ميتا محلية لإرسالها للطرف الآخر عند الطلب === */
function localMeta_dm(): DitonaAny_dm {
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

function sendDCMeta_dm(room: any) {
  try {
    if (!room) return;
    const payload = { t: "meta", pairId: pid_dm(), meta: localMeta_dm() };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" });
  } catch {}
}

/* === إرفاق مستمع DC مع منع التكرار وإرسال meta:init فورًا === */
function attachMeta_dm(room: any) {
  if (!room || typeof room?.on !== "function") return;

  const RoomEvent = (globalThis as any).livekit?.RoomEvent;
  const ev = RoomEvent?.DataReceived || "data-received";

  const onData = (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
    const j = parse_dm(payload);
    if (!j) return;

    // لا نعتمد على topic فقط. نعرّف meta من المحتوى أيضًا.
    const topicIsMeta = (topic || "").toLowerCase() === "meta";
    const looksLikeMeta =
      j?.t === "meta" || j?.t === "peer-meta" || j?.t === "meta:init" || (j && typeof j.meta === "object");
    if (!(topicIsMeta || looksLikeMeta)) return;

    if (j.t === "meta:init") {
      sendDCMeta_dm(room); // ردّ بالميتا المحلية
      return;
    }

    const flat = flatMeta_dm(j);
    if (flat) emitPeer_dm(flat);
  };

  // منع تكرار المستمع
  const key = "__ditona_meta_onData_dm";
  try {
    const prev = (room as any)[key];
    if (prev) room.off?.(ev, prev);
  } catch {}
  room.on(ev, onData as any);
  (room as any)[key] = onData;

  // اطلب ميتا الطرف فور الارتباط + إعادة طلب سريعة
  try {
    const bytes = new TextEncoder().encode(JSON.stringify({ t: "meta:init", pairId: pid_dm() }));
    room?.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" });
    setTimeout(() => {
      try { room?.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" }); } catch {}
    }, 250);
  } catch {}
}

/* === إقلاع وربط عند جاهزية الغرفة أو حدث lk:attached === */
(function boot_dm() {
  try {
    const w: any = globalThis as any;
    if (w.__lkRoom) attachMeta_dm(w.__lkRoom);
  } catch {}

  const onAttached = () => {
    try {
      const w: any = globalThis as any;
      if (w.__lkRoom) attachMeta_dm(w.__lkRoom);
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
      const ev = RoomEvent?.DataReceived || "data-received";
      const key = "__ditona_meta_onData_dm";
      const prev = r?.[key];
      if (r && prev) r.off?.(ev, prev);
    } catch {}
  };
})();
