// src/app/chat/dcMetaResponder.client.ts
"use client";

/**
 * Bridge: LiveKit DC "meta"  →  window "ditona:peer-meta"
 * يدعم الصيغ:
 *  - {t:"meta", pairId?, meta:{...}}
 *  - {pairId?, meta:{...}}
 *  - {t:"peer-meta", payload:{...}}   // توافق قديم
 *  - {t:"meta:init"}                  // طلب الميتا المحلية
 *
 * يبث دائمًا:
 *  window.dispatchEvent(new CustomEvent("ditona:peer-meta",{detail:{pairId,...}}))
 *
 * لا تبعيات ولا ENV.
 */

/* == أسماء فريدة لتفادي التعارض مع ملفات أخرى == */
type DitonaAny_dm2 = Record<string, any>;

function dm2_pid(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

function dm2_parse(x: Uint8Array | string): DitonaAny_dm2 | null {
  try {
    const s = typeof x === "string" ? x : new TextDecoder().decode(x);
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function dm2_flatMeta(src: DitonaAny_dm2): DitonaAny_dm2 | null {
  if (!src || typeof src !== "object") return null;

  // توافق قديم
  if (src.t === "peer-meta" && src.payload && typeof src.payload === "object") {
    const d = src.payload;
    const pid = d.pairId ?? src.pairId ?? dm2_pid();
    const meta = d.meta && typeof d.meta === "object" ? d.meta : d;
    return { pairId: pid, ...meta };
  }

  // الصيغ الأساسية
  const hasMeta = src.meta && typeof src.meta === "object";
  if (hasMeta || src.t === "meta") {
    const pid = src.pairId ?? src.meta?.pairId ?? dm2_pid();
    const meta = hasMeta ? src.meta : {};
    return { pairId: pid, ...meta };
  }

  return null;
}

function dm2_emit(detail: DitonaAny_dm2) {
  const ePid = detail?.pairId;
  const now = dm2_pid();
  if (ePid && now && ePid !== now) return; // إسقاط زوج قديم
  window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail }));
}

function dm2_localMeta(): DitonaAny_dm2 {
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

function dm2_sendLocalMeta(room: any) {
  try {
    if (!room) return;
    const payload = { t: "meta", pairId: dm2_pid(), meta: dm2_localMeta() };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    room.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" });
  } catch {}
}

function dm2_requestRemoteMeta(room: any, pairId?: string | null) {
  try {
    const pid = pairId ?? dm2_pid();
    const bytes = new TextEncoder().encode(JSON.stringify({ t: "meta:init", pairId: pid }));
    room?.localParticipant?.publishData(bytes, { reliable: true, topic: "meta" });
  } catch {}
}

function dm2_attach(room: any) {
  if (!room || typeof room?.on !== "function") return;

  const RoomEvent = (globalThis as any).livekit?.RoomEvent;
  const EV = RoomEvent?.DataReceived || "data-received";

  const onData = (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
    const j = dm2_parse(payload);
    if (!j) return;

    const topicIsMeta = (topic || "").toLowerCase() === "meta";
    const looksLikeMeta =
      j?.t === "meta" || j?.t === "peer-meta" || j?.t === "meta:init" || (j && typeof j.meta === "object");
    if (!(topicIsMeta || looksLikeMeta)) return;

    if (j.t === "meta:init") {
      dm2_sendLocalMeta(room);
      return;
    }

    const flat = dm2_flatMeta(j);
    if (flat) dm2_emit(flat);
  };

  // منع التكرار
  const KEY = "__dm2_meta_handler";
  try {
    const prev = (room as any)[KEY];
    if (prev) room.off?.(EV, prev);
  } catch {}
  room.on(EV, onData as any);
  (room as any)[KEY] = onData;

  // طلب/إرسال عند الارتباط
  dm2_requestRemoteMeta(room);
  setTimeout(() => dm2_requestRemoteMeta(room), 250);
  dm2_sendLocalMeta(room);
}

/* boot */
(function dm2_boot() {
  try {
    const w: any = globalThis as any;
    if (w.__lkRoom) dm2_attach(w.__lkRoom);
  } catch {}

  const onAttached = () => {
    try {
      const w: any = globalThis as any;
      if (w.__lkRoom) dm2_attach(w.__lkRoom);
    } catch {}
  };
  window.addEventListener("lk:attached", onAttached as any, { passive: true } as any);

  // عند تغيّر الزوج اطلب/أرسل الميتا
  const onPair = (ev: Event) => {
    try {
      const w: any = globalThis as any;
      const r = w.__lkRoom;
      const pid = (ev as CustomEvent)?.detail?.pairId ?? dm2_pid();
      dm2_requestRemoteMeta(r, pid);
      dm2_sendLocalMeta(r);
    } catch {}
  };
  window.addEventListener("rtc:pair", onPair as any, { passive: true } as any);

  // مُنظّف اختياري
  (globalThis as any).__dm2_meta_cleanup = () => {
    window.removeEventListener("lk:attached", onAttached as any);
    window.removeEventListener("rtc:pair", onPair as any);
    try {
      const w: any = globalThis as any;
      const r = w.__lkRoom;
      const RoomEvent = (globalThis as any).livekit?.RoomEvent;
      const EV = RoomEvent?.DataReceived || "data-received";
      const KEY = "__dm2_meta_handler";
      const prev = r?.[KEY];
      if (r && prev) r.off?.(EV, prev);
    } catch {}
  };
})();
