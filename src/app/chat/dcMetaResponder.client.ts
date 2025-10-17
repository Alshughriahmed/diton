// src/app/chat/dcMetaResponder.client.ts
"use client";

/**
 * Peer meta responder over global DC.
 * مصدر الحقيقة: profile.gender.
 * يرسل على: استقبال {t:"meta:init"}, تغيّر المرحلة matched/connected،
 * profile:updated، و ditona:geo. يرسل مرّتين بفاصل 250ms.
 * يستخدم dcShim أولاً ثم LiveKit publishData كبديل.
 */

import { useProfile } from "@/state/profile";
import { normalizeGender } from "@/lib/gender";

declare global {
  interface Window {
    __dcMetaResponderMounted?: 1;
  }
}

type Geo = { countryCode?: string; country?: string; city?: string };
type Payload = {
  displayName?: string;
  avatar?: string;
  vip?: boolean;
  country?: string;
  city?: string;
  gender?: string; // m|f|c|l|u
  likes?: number;
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
  const avatar = String(p?.avatarUrl || p?.avatar || p?.photo || "").trim() || undefined;
  const vip = !!(p?.vip || p?.isVip || p?.premium || p?.pro);
  const gender = normalizeGender(p?.gender);
  const likes =
    typeof p?.likes === "number"
      ? p.likes
      : typeof p?.likeCount === "number"
      ? p.likeCount
      : undefined;

  return { displayName, avatar, vip, country: g.country, city: g.city, gender, likes };
}

function sendJSON(obj: any) {
  try {
    const dc: any = (window as any).__ditonaDataChannel;
    if (dc?.send) {
      dc.send(JSON.stringify(obj));
      return;
    }
  } catch {}
  try {
    const room: any = (window as any).__lkRoom;
    if (room?.localParticipant?.publishData) {
      const data = new TextEncoder().encode(JSON.stringify(obj));
      room.localParticipant.publishData(data, { reliable: true, topic: "meta" });
    }
  } catch {}
}

const sendPeerMetaOnce = () => sendJSON({ t: "peer-meta", payload: buildPayload() });
const sendPeerMetaTwice = () => {
  sendPeerMetaOnce();
  setTimeout(sendPeerMetaOnce, 250);
};

(function attach() {
  if (!isBrowser || window.__dcMetaResponderMounted) return;
  window.__dcMetaResponderMounted = 1;

  const onDCMessage = (ev: any) => {
    try {
      const txt = typeof ev?.data === "string" ? ev.data : new TextDecoder().decode(ev?.data);
      // إصلاح regex: يجب أن يكون /^\s*\{/ وليس /\s*\{/
      if (!txt || !/^\s*\{/.test(txt)) return;
      const j = JSON.parse(txt);
      if (j?.t === "meta:init") sendPeerMetaTwice();
    } catch {}
  };

  // ربط الـ DC الآن ثم إعادة المحاولة إن تأخر الشيم
  const tryWire = () => {
    try {
      const dc: any = (window as any).__ditonaDataChannel;
      dc?.addEventListener?.("message", onDCMessage);
    } catch {}
  };
  tryWire();

  // إشارات التطبيق
  const onGeo = () => sendPeerMetaTwice();
  const onProfile = () => sendPeerMetaTwice();
  const onPhase = (e: any) => {
    const ph = e?.detail?.phase;
    if (ph === "matched" || ph === "connected") sendPeerMetaTwice();
  };
  const onMetaInitEvt = () => sendPeerMetaTwice(); // من ChatClient عند استقبال meta:init عبر LiveKit

  window.addEventListener("ditona:geo", onGeo as any);
  window.addEventListener("profile:updated", onProfile as any);
  window.addEventListener("rtc:phase", onPhase as any);
  window.addEventListener("ditona:meta:init", onMetaInitEvt as any);

  // إعادة المحاولة لالتقاط الشيم إن تأخر
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const dc: any = (window as any).__ditonaDataChannel;
    if (dc?.addEventListener) {
      dc.addEventListener("message", onDCMessage);
      clearInterval(iv);
    }
    if (tries > 40) clearInterval(iv);
  }, 100);

  // Cleanup
  window.addEventListener(
    "pagehide",
    () => {
      try {
        const dc: any = (window as any).__ditonaDataChannel;
        dc?.removeEventListener?.("message", onDCMessage);
        window.removeEventListener("ditona:geo", onGeo as any);
        window.removeEventListener("profile:updated", onProfile as any);
        window.removeEventListener("rtc:phase", onPhase as any);
        window.removeEventListener("ditona:meta:init", onMetaInitEvt as any);
        window.__dcMetaResponderMounted = undefined;
      } catch {}
    },
    { once: true }
  );
})();

export {};
