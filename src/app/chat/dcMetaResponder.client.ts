/**
 * LiveKit DataChannel → window events (META فقط).
 * - topic="meta":
 *    • {t:"peer-meta", payload}  →  ditona:peer-meta  (+pairId)
 *    • {t:"meta:init"}          →  ditona:meta:init  ثم sendMyMeta() مرّتين
 *    • توافق: جسم ميتا مباشرةً   →  ditona:peer-meta  (+pairId)
 * لا يتعامل مع topic="like"؛ likeSyncClient مسؤول عنه.
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

  const curPair = (): string | null => {
    try {
      const w: any = window as any;
      return w.__ditonaPairId || w.__pairId || null;
    } catch { return null; }
  };

  // ---- compose & send my meta (مطابق لـ peerMetaUi) ----
  function stableDid(): string {
    try {
      const k = "ditona_did";
      const v = localStorage.getItem(k);
      if (v) return v;
      const gen = crypto?.randomUUID?.() || "did-" + Math.random().toString(36).slice(2, 9);
      localStorage.setItem(k, gen);
      return gen;
    } catch { return "did-" + Math.random().toString(36).slice(2, 9); }
  }

  function readGeo() {
    try {
      const g = JSON.parse(localStorage.getItem("ditona_geo") || "null");
      return { country: g?.country ?? null, city: g?.city ?? null };
    } catch { return { country: null, city: null }; }
  }

  function readProfile() {
    let displayName = "", gender = "", avatarUrl = "";
    let vip = false, hideCountry = false, hideCity = false, hideLikes = false;
    try {
      const raw =
        localStorage.getItem("ditona.profile.v1") ||
        localStorage.getItem("ditona_profile")   ||
        localStorage.getItem("profile");
      if (raw) {
        const p = JSON.parse(raw); const s = p?.state ?? p;
        displayName = s?.displayName ?? "";
        gender = s?.gender ?? "";
        avatarUrl = s?.avatarDataUrl ?? "";
        vip = !!s?.vip;
        hideCountry = !!s?.privacy?.hideCountry;
        hideCity = !!s?.privacy?.hideCity;
        const showCount = s?.likes?.showCount;
        hideLikes = typeof showCount === "boolean" ? !showCount : false;
      }
    } catch {}
    return { displayName, gender, avatarUrl, vip, hideCountry, hideCity, hideLikes };
  }

  function composeMyMeta() {
    const { country, city } = readGeo();
    const p = readProfile();
    return {
      did: stableDid(),
      country, city,
      gender: p.gender,
      avatarUrl: p.avatarUrl,
      displayName: p.displayName,
      vip: p.vip,
      likes: 0,
      hideCountry: !!p.hideCountry,
      hideCity: !!p.hideCity,
      hideLikes: !!p.hideLikes,
    };
  }

  async function sendMyMeta() {
    try {
      const room: any = (window as any).__lkRoom;
      if (!room?.localParticipant?.publishData) return;
      const bin = new TextEncoder().encode(JSON.stringify({ t: "peer-meta", payload: composeMyMeta() }));
      await room.localParticipant.publishData(bin, { reliable: true, topic: "meta" });
    } catch {}
  }

  // ---- wiring ----
  let curRoom: any = null;
  let off: (() => void) | null = null;

  function attachRoom(room: any) {
    if (!room?.on || curRoom === room) return;
    try { off?.(); } catch {} ; off = null;
    curRoom = room;

    const onData = (payload: Uint8Array, _p?: any, _k?: any, topic?: string) => {
      if (topic !== "meta") return;
      const j = parse(payload);
      if (!j || typeof j !== "object") return;

      // جاهزة
      if (j.t === "peer-meta" && j.payload) {
        dispatch("ditona:peer-meta", { ...j.payload, pairId: curPair() });
        return;
      }

      // طلب
      if (j.t === "meta:init") {
        dispatch("ditona:meta:init", {});
        sendMyMeta();
        setTimeout(sendMyMeta, 250);
        return;
      }

      // توافق
      if (!j.t && (j.gender || j.country || j.city || j.displayName || j.avatar || j.avatarUrl)) {
        dispatch("ditona:peer-meta", { ...j, pairId: curPair() });
      }
    };

    // الاسم النصي يعمل دون استيراد RoomEvent
    room.on("dataReceived", onData);
    off = () => { try { room.off("dataReceived", onData); } catch {} };
  }

  attachRoom((window as any).__lkRoom);
  window.addEventListener("lk:attached", () => attachRoom((window as any).__lkRoom), { passive: true } as any);
  window.addEventListener("ditona:meta:init", () => { sendMyMeta(); }, { passive: true } as any);
  window.addEventListener("pagehide", () => { try { off?.(); } catch {} }, { once: true } as any);
}
export {};
