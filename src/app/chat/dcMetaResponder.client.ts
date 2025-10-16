// src/app/chat/dcMetaResponder.client.ts
"use client";

/**
 * Reply to {t:"meta:init"} with normalized peer meta from profile + geo.
 * Source of truth for gender: profile.gender only.
 * Sends over window.__ditonaDataChannel, falls back to LiveKit publishData.
 * Resends on "rtc:phase=connected", "profile:updated", and "ditona:geo".
 */

import { useProfile } from "@/state/profile";
import { normalizeGender } from "@/lib/gender";

type Geo = { countryCode?: string; country?: string; city?: string };
type Payload = {
  displayName?: string;
  avatarUrl?: string;
  vip?: boolean;
  country?: string;
  city?: string;
  gender?: string; // standardized to: male|female|couple|lgbt
  likes?: number;
};

const isBrowser = typeof window !== "undefined";

// ---------- helpers ----------
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
  const genderStd = normalizeGender(p?.gender);

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
    gender: genderStd,
    likes,
  };
}

function sendJSON(obj: any) {
  // try DC shim first
  try {
    const dc: any = (window as any).__ditonaDataChannel;
    if (dc?.send) {
      dc.send(JSON.stringify(obj));
      return;
    }
  } catch {}
  // fallback LiveKit
  try {
    const room: any = (window as any).__lkRoom;
    if (room?.localParticipant?.publishData) {
      const data = new TextEncoder().encode(JSON.stringify(obj));
      room.localParticipant.publishData(data, { reliable: true, topic: "meta" });
    }
  } catch {}
}

function sendPeerMeta() {
  sendJSON({ t: "peer-meta", payload: buildPayload() });
}

function attachOnce() {
  if (!isBrowser) return;
  const dc: any = (window as any).__ditonaDataChannel;
  if (!dc?.addEventListener) return;

  const onMsg = (ev: any) => {
    try {
      const txt = typeof ev?.data === "string" ? ev.data : new TextDecoder().decode(ev?.data);
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

  // HMR cleanup
  if ((import.meta as any)?.hot) {
    (import.meta as any).hot.dispose(() => {
      try { dc.removeEventListener?.("message", onMsg as any); } catch {}
      window.removeEventListener("ditona:geo", onGeo as any);
      window.removeEventListener("profile:updated", onProfile as any);
      window.removeEventListener("rtc:phase", onPhase as any);
    });
  }
}

// boot: wait until shim attaches
(function boot() {
  if (!isBrowser) return;
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    attachOnce();
    if ((window as any).__ditonaDataChannel?.addEventListener || tries > 40) clearInterval(iv);
  }, 100);
})();
