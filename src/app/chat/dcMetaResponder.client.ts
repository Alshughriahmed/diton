// src/app/chat/dcMetaResponder.client.ts
/**
 * LiveKit DataChannel -> window events bridge (meta only).
 * - topic "meta": forward {t:"peer-meta", payload} to "ditona:peer-meta"
 * - topic "meta": on {t:"meta:init"} -> emit "ditona:meta:init" and send my peer-meta twice
 * لا يتعامل مع topic "like" لتجنّب الازدواج؛ likeSyncClient هو المسؤول.
 */

if (typeof window !== "undefined" && !(window as any).__dcMetaResponderMounted) {
  (window as any).__dcMetaResponderMounted = 1;

  const parse = (b: ArrayBuffer | Uint8Array | string) => {
    try {
      if (typeof b === "string") return JSON.parse(b);
      const u8 = b instanceof Uint8Array ? b : new Uint8Array(b as ArrayBuffer);
      return JSON.parse(new TextDecoder().decode(u8));
    } catch { return null; }
  };

  const dispatch = (name: string, detail?: any) => {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  };

  // -------- compose my meta (مطابق لـ peerMetaUi) --------
  function stableDid(): string {
    try {
      const k = "ditona_did";
      const v = localStorage.getItem(k);
      if (v) return v;
      const gen = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem(k, gen);
      return gen;
    } catch {
      return "did-" + Math.random().toString(36).slice(2, 9);
    }
  }

  function readGeo() {
    try {
      const g = JSON.parse(localStorage.getItem("ditona_geo") || "null");
      return { country: g?.country ?? null, city: g?.city ?? null };
    } catch {
      return { country: null, city: null };
    }
  }

  function readProfile() {
    let displayName = "";
    let gender = "";
    let avatarUrl = "";
    let vip = false;
    let hideCountry = false;
    let hideCity = false;
    let hideLikes = false;
    try {
      const raw =
        localStorage.getItem("ditona.profile.v1") ||
        localStorage.getItem("ditona_profile") ||
        localStorage.getItem("profile");
      if (raw) {
        const p = JSON.parse(raw);
        const state = p?.state ?? p;
        displayName = state?.displayName ?? "";
        gender = state?.gender ?? "";
        avatarUrl = state?.avatarDataUrl ?? "";
        vip = !!state?.vip;
        hideCountry = !!state?.privacy?.hideCountry;
        hideCity = !!state?.privacy?.hideCity;
        const showCount = state?.likes?.showCount;
        hideLikes = typeof showCount === "boolean" ? !showCount : false;
      }
    } catch {}
    return { displayName, gender, avatarUrl, vip, hideCountry, hideCity, hideLikes };
  }

  function composeMyMeta() {
    const { country, city } = readGeo();
    const prof = readProfile();
    return {
      did: stableDid(),
      country,
      city,
      gender: prof.gender,
      avatarUrl: prof.avatarUrl,
      displayName: prof.displayName,
      vip: prof.vip,
      likes: 0,
      hideCountry: !!prof.hideCountry,
      hideCity: !!prof.hideCity,
      hideLikes: !!prof.hideLikes,
    };
  }

  async function sendMyMeta() {
    try {
      const room: any = (window as any).__lkRoom;
      if (!room?.localParticipant?.publishData) return;
      const msg = { t: "peer-meta", payload: composeMyMeta() };
      const bin = new TextEncoder().encode(JSON.stringify(msg));
      await room.localParticipant.publishData(bin, { reliable: true, topic: "meta" });
    } catch {}
  }

  // -------- wiring --------
  let curRoom: any = null;
  let off: (() => void) | null = null;

  function attachRoom(room: any) {
    if (!room || !room.on) return;
    if (curRoom === room) return;

    if (off) { try { off(); } catch {} off = null; }
    curRoom = room;

    const onData = (payload: Uint8Array, _p?: any, _k?: any, topic?: string) => {
      if (topic !== "meta") return;
      const j = parse(payload);
      if (!j || typeof j !== "object") return;

      // وصلتنا ميتا جاهزة
      if (j.t === "peer-meta" && j.payload) {
        dispatch("ditona:peer-meta", j.payload);
        return;
      }

      // طلب الميتا
      if (j.t === "meta:init") {
        dispatch("ditona:meta:init", {});
        // ردّ مزدوج لتفادي السباقات المبكرة
        sendMyMeta();
        setTimeout(sendMyMeta, 250);
        return;
      }

      // توافق: payload يبدو ميتا مباشرةً
      if (!j.t && (j.gender || j.country || j.city || j.displayName || j.avatar || j.avatarUrl)) {
        dispatch("ditona:peer-meta", j);
      }
    };

    // "dataReceived" هو اسم الحدث في livekit-client على الكائن Room
    room.on("dataReceived", onData);
    off = () => { try { room.off("dataReceived", onData); } catch {} };
  }

  // حاول الربط الفوري ثم عند الإرفاق
  attachRoom((window as any).__lkRoom);
  window.addEventListener("lk:attached", () => attachRoom((window as any).__lkRoom), { passive: true } as any);

  // استجابة محلية لطلب الميتا
  window.addEventListener("ditona:meta:init", () => { sendMyMeta(); }, { passive: true } as any);

  window.addEventListener("pagehide", () => { try { off?.(); } catch {} }, { once: true } as any);
}

export {};
