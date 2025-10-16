// src/app/chat/dcMetaResponder.client.ts
"use client";

/**
 * يردّ على {t:"meta:init"} ببيانات ميتا موحّدة للطرف الآخر.
 * المصادر: profile store + localStorage("ditona_geo").
 * الإرسال عبر الشيم window.__ditonaDataChannel، مع fallback إلى LiveKit publishData.
 * يعيد الإرسال عند تغيّر geo أو profile أو عند الانتقال إلى حالة connected.
 */

import { useProfile } from "@/state/profile";

type Geo = { countryCode?: string; country?: string; city?: string };
type Payload = {
  displayName?: string;
  avatarUrl?: string;
  vip?: boolean;
  country?: string;
  city?: string;
  gender?: string; // يستقبلها الطرف الآخر ويطبّعها
  likes?: number;
};

const isBrowser = typeof window !== "undefined";

// ========= helpers =========
function readGeo(): Geo {
  try {
    const raw = localStorage.getItem("ditona_geo");
    if (!raw) return {};
    const j = JSON.parse(raw);
    return {
      countryCode: String(j.countryCode || j.cc || "").toUpperCase(),
      country: String(j.country || j.cn || j.ctry || j.country_name || j.countryCode || ""),
      city: String(j.city || j.locality || j.town || ""),
    };
  } catch {
    return {};
  }
}

function readProfile() {
  try {
    const st = (useProfile as any)?.getState?.();
    return st?.profile ?? {};
  } catch {
    return {};
  }
}

function buildPayload(): Payload {
  const p: any = readProfile();
  const g = readGeo();

  const displayName = String(p?.displayName || p?.name || "").trim() || undefined;
  const avatarUrl = String(p?.avatarUrl || p?.avatar || p?.photo || "").trim() || undefined;
  const vip = !!(p?.vip || p?.isVip || p?.premium || p?.pro);

  const genderRaw =
    p?.gender ??
    p?.sex ??
    p?.g ??
    p?.genderEmoji ??
    p?.genderSymbol ??
    p?.gender_symbol ??
    "";

  const likes =
    typeof p?.likes === "number"
      ? p.likes
      : typeof p?.likeCount === "number"
      ? p.likeCount
      : undefined;

  return {
    displayName,
    avatarUrl,
    vip,
    country: g.country,
    city: g.city,
    gender: genderRaw,
    likes,
  };
}

function sendJSON(obj: any) {
  try {
    const s = JSON.stringify(obj);
    const dc: any = (window as any).__ditonaDataChannel;
    if (dc?.send) {
      dc.send(s);
      return;
    }
  } catch {}
  // Fallback LiveKit publishData
  try {
    const room: any = (window as any).__lkRoom;
    if (room?.localParticipant?.publishData) {
      const data = new TextEncoder().encode(JSON.stringify(obj));
      room.localParticipant.publishData(data, { reliable: true, topic: "meta" });
    }
  } catch {}
}

function sendPeerMeta() {
  const payload = buildPayload();
  sendJSON({ t: "peer-meta", payload });
}

// ========= wiring =========
function attachOnce() {
  if (!isBrowser) return;
  const dc: any = (window as any).__ditonaDataChannel;
  if (!dc?.addEventListener) return;

  const onMsg = (ev: any) => {
    try {
      const txt =
        typeof ev?.data === "string" ? ev.data : new TextDecoder().decode(ev?.data);
      if (!txt || !/^\s*\{/.test(txt)) return;
      const j = JSON.parse(txt);
      if (j?.t === "meta:init") sendPeerMeta();
    } catch {}
  };

  dc.addEventListener("message", onMsg);

  const onGeo = () => sendPeerMeta();
  const onProfile = () => sendPeerMeta();
  const onPhase = (e: any) => { if (e?.detail?.phase === "connected") sendPeerMeta(); };

  window.addEventListener("ditona:geo", onGeo as any);
  window.addEventListener("profile:updated", onProfile as any);
  window.addEventListener("rtc:phase", onPhase as any);

  // cleanup for HMR
  if ((import.meta as any)?.hot) {
    (import.meta as any).hot.dispose(() => {
      try { dc.removeEventListener?.("message", onMsg as any); } catch {}
      window.removeEventListener("ditona:geo", onGeo as any);
      window.removeEventListener("profile:updated", onProfile as any);
      window.removeEventListener("rtc:phase", onPhase as any);
    });
  }
}

// boot: انتظر حتى يجهز الشيم
(function boot() {
  if (!isBrowser) return;
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    attachOnce();
    if ((window as any).__ditonaDataChannel?.addEventListener || tries > 40) clearInterval(iv);
  }, 100);
})();
