// src/app/chat/dcMetaResponder.client.ts
"use client";
/**
Peer meta responder over global DC shim.

Source of truth: profile (gender, privacy, likes)
Triggers send on:
- DC message {t:"meta:init"}  (also dispatches "ditona:meta:init")
- window "ditona:meta:init" (from ChatClient on DataReceived)
- window "rtc:phase" => matched|connected
- window "profile:updated"
- window "ditona:geo"
- optional: "dc:attached", "lk:attached", "livekit:participant-connected"

Sends twice (250ms apart). Falls back to LiveKit publishData(topic:"meta").
*/
import { useProfile } from "@/state/profile";
import { normalizeGender } from "@/lib/gender";

type Geo = { countryCode?: string; country?: string; city?: string };
type Payload = {
  displayName?: string;
  avatar?: string;
  vip?: boolean;
  country?: string;
  city?: string;
  gender?: string; // "m" | "f" | "c" | "l" | "u"
  likes?: number;
  hideCountry?: boolean;
  hideCity?: boolean;
  hideLikes?: boolean;
};

const isBrowser = typeof window !== "undefined";

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
  const avatar = String(p?.avatarUrl || p?.avatar || p?.photo || p?.avatarDataUrl || "").trim() || undefined;
  const vip = !!(p?.vip || p?.isVip || p?.premium || p?.pro);

  const gender = normalizeGender(p?.gender);
  const likes =
    typeof p?.likes === "number"
      ? p.likes
      : typeof p?.likeCount === "number"
      ? p.likeCount
      : typeof p?.likes?.count === "number"
      ? p.likes.count
      : undefined;

  const hideCountry = !!p?.privacy?.hideCountry;
  const hideCity = !!p?.privacy?.hideCity;
  const hideLikes = !Boolean(p?.likes?.showCount);

  return {
    displayName,
    avatar,
    vip,
    country: hideCountry ? undefined : g.country,
    city: hideCity ? undefined : g.city,
    gender,
    likes: hideLikes ? undefined : likes,
    hideCountry,
    hideCity,
    hideLikes,
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

function sendPeerMetaOnce() {
  sendJSON({ t: "peer-meta", payload: buildPayload() });
}

function sendPeerMetaTwice() {
  sendPeerMetaOnce();
  setTimeout(sendPeerMetaOnce, 250);
}

function attachOnce() {
  if (!isBrowser) return;
  if ((window as any).__dcMetaResponderBound) return;
  const dc: any = (window as any).__ditonaDataChannel;
  if (!dc?.addEventListener) return;
  (window as any).__dcMetaResponderBound = 1;

  // DC inbound messages
  const onMsg = (ev: MessageEvent) => {
    try {
      const d = (ev as any)?.data;
      let txt: string | null = null;
      if (typeof d === "string") txt = d;
      else if (d instanceof ArrayBuffer) txt = new TextDecoder().decode(new Uint8Array(d));
      else if (ArrayBuffer.isView(d)) txt = new TextDecoder().decode(d as any);
      if (!txt || !/^\s*\{/.test(txt)) return;

      const j = JSON.parse(txt);
      if (j?.t === "meta:init") {
        try {
          window.dispatchEvent(new CustomEvent("ditona:meta:init"));
        } catch {}
        sendPeerMetaTwice();
      }
    } catch {}
  };
  dc.addEventListener("message", onMsg as any);

  // App-level triggers
  const onGeo = () => sendPeerMetaTwice();
  const onProfile = () => sendPeerMetaTwice();
  const onPhase = (e: any) => {
    const ph = e?.detail?.phase;
    if (ph === "matched" || ph === "connected") sendPeerMetaTwice();
  };
  const onInitEvt = () => sendPeerMetaTwice();

  // optional hooks announced by ChatClient
  const onDCAttached = () => sendPeerMetaTwice();
  const onLkAttached = () => sendPeerMetaTwice();
  const onLkParticipantConnected = () => sendPeerMetaTwice();

  window.addEventListener("ditona:geo", onGeo as any);
  window.addEventListener("profile:updated", onProfile as any);
  window.addEventListener("rtc:phase", onPhase as any);
  window.addEventListener("ditona:meta:init", onInitEvt as any);
  window.addEventListener("dc:attached", onDCAttached as any);
  window.addEventListener("lk:attached", onLkAttached as any);
  window.addEventListener("livekit:participant-connected", onLkParticipantConnected as any);

  // HMR cleanup
  if ((import.meta as any)?.hot) {
    (import.meta as any).hot.dispose(() => {
      try {
        dc.removeEventListener?.("message", onMsg as any);
      } catch {}
      window.removeEventListener("ditona:geo", onGeo as any);
      window.removeEventListener("profile:updated", onProfile as any);
      window.removeEventListener("rtc:phase", onPhase as any);
      window.removeEventListener("ditona:meta:init", onInitEvt as any);
      window.removeEventListener("dc:attached", onDCAttached as any);
      window.removeEventListener("lk:attached", onLkAttached as any);
      window.removeEventListener("livekit:participant-connected", onLkParticipantConnected as any);
      (window as any).__dcMetaResponderBound = 0;
    });
  }
}

// boot: wait until shim attaches
(function boot() {
  if (!isBrowser) return;
  if ((window as any).__dcMetaResponderMounted) return;
  (window as any).__dcMetaResponderMounted = 1;
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    attachOnce();
    const ready = !!(window as any).__ditonaDataChannel?.addEventListener;
    if (ready || tries > 50) clearInterval(iv);
  }, 100);
})();
