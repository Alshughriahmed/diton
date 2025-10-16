// src/app/chat/dcMetaResponder.client.ts
"use client";

/**
 * Reply to {t:"meta:init"} with normalized peer meta.
 * Gender source priority: filters.gender → profile.gender → localStorage("ditona_gender").
 * Also resends on geo/profile/filters updates and when phase becomes "connected".
 * Sends through window.__ditonaDataChannel, falls back to LiveKit publishData.
 */

import { useProfile } from "@/state/profile";
import { useFilters } from "@/state/filters";

type Geo = { countryCode?: string; country?: string; city?: string };
type Payload = {
  displayName?: string;
  avatarUrl?: string;
  vip?: boolean;
  country?: string;
  city?: string;
  gender?: string; // free text; receiver normalizes
  likes?: number;
};

const isBrowser = typeof window !== "undefined";

/* ---------- helpers ---------- */
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

function readFilters() {
  try {
    const st = (useFilters as any)?.getState?.();
    return { gender: st?.gender, countries: st?.countries };
  } catch {
    return {};
  }
}

function normGender(v: any): "male" | "female" | "couple" | "lgbt" | undefined {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return undefined;
  if (s === "m" || s.startsWith("male") || s.includes("♂")) return "male";
  if (s === "f" || s.startsWith("female") || s.includes("♀")) return "female";
  if (s.includes("couple") || s.includes("pairs") || s.includes("pair") || s.includes("👨") || s.includes("👩")) return "couple";
  if (s.includes("lgbt") || s.includes("pride") || s.includes("🏳️‍🌈") || s.includes("gay")) return "lgbt";
  // Arabic fallbacks
  if (s.includes("ذكر")) return "male";
  if (s.includes("أنث") || s.includes("انث")) return "female";
  if (s.includes("زوج")) return "couple";
  if (s.includes("مثلي")) return "lgbt";
  return undefined;
}

function readGender(): string | undefined {
  const f = readFilters().gender;
  const p: any = readProfile();
  const ls =
    ((): string | undefined => {
      try { return localStorage.getItem("ditona_gender") || undefined; } catch { return undefined; }
    })();

  return normGender(f) || normGender(p?.gender) || normGender(ls) || undefined;
}

function buildPayload(): Payload {
  const p: any = readProfile();
  const g = readGeo();

  const displayName = String(p?.displayName || p?.name || "").trim() || undefined;
  const avatarUrl = String(p?.avatarUrl || p?.avatar || p?.photo || "").trim() || undefined;
  const vip = !!(p?.vip || p?.isVip || p?.premium || p?.pro);
  const gender = readGender();

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
    gender,
    likes,
  };
}

function sendJSON(obj: any) {
  // try DC shim first
  try {
    const dc: any = (window as any).__ditonaDataChannel;
    if (dc?.send) { dc.send(JSON.stringify(obj)); return; }
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

/* ---------- wiring ---------- */
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
  const onFilters = () => sendPeerMeta();
  const onPhase = (e: any) => { if (e?.detail?.phase === "connected") sendPeerMeta(); };

  window.addEventListener("ditona:geo", onGeo as any);
  window.addEventListener("profile:updated", onProfile as any);
  window.addEventListener("filters:updated", onFilters as any);
  window.addEventListener("rtc:phase", onPhase as any);

  if ((import.meta as any)?.hot) {
    (import.meta as any).hot.dispose(() => {
      try { dc.removeEventListener?.("message", onMsg as any); } catch {}
      window.removeEventListener("ditona:geo", onGeo as any);
      window.removeEventListener("profile:updated", onProfile as any);
      window.removeEventListener("filters:updated", onFilters as any);
      window.removeEventListener("rtc:phase", onPhase as any);
    });
  }
}

// boot
(function boot() {
  if (!isBrowser) return;
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    attachOnce();
    if ((window as any).__ditonaDataChannel?.addEventListener || tries > 40) clearInterval(iv);
  }, 100);
})();
