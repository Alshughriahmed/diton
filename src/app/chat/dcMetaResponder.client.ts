/**
 * LiveKit DataChannel → window events (META فقط).
 * يقبل:
 *  - topic === "meta" أو أي رسالة تحمل جسماً له {t:"peer-meta"| "meta:init"} أو جسم ميتا مباشر.
 * يُصدر:
 *  - ditona:peer-meta  (+pairId دائماً)
 *  - ditona:meta:init
 * لا يتعامل مع topic="like".
 */
if (typeof window !== "undefined" && !(window as any).__dcMetaResponderMounted) {
  (window as any).__dcMetaResponderMounted = 1;

  /* ---------- utils ---------- */
  const toJSON = (b: ArrayBuffer | Uint8Array | string) => {
    try {
      if (typeof b === "string") return JSON.parse(b);
      const u8 = b instanceof Uint8Array ? b : new Uint8Array(b as ArrayBuffer);
      return JSON.parse(new TextDecoder().decode(u8));
    } catch { return null; }
  };

  const fire = (name: string, detail?: any) => {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  };

  const pairId = (): string | null => {
    try {
      const w: any = window;
      return w.__ditonaPairId || w.__pairId || null;
    } catch { return null; }
  };

  /* ---------- compose my meta (متوافق مع peerMetaUi) ---------- */
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
        displayName = s?.displayName ?? s?.profile?.displayName ?? "";
        gender      = s?.gender ?? s?.profile?.gender ?? "";
        avatarUrl   = s?.avatarDataUrl ?? s?.profile?.avatarDataUrl ?? "";
        vip         = !!(s?.vip ?? s?.profile?.vip);
        hideCountry = !!(s?.privacy?.hideCountry);
        hideCity    = !!(s?.privacy?.hideCity);
        const showCount = s?.likes?.showCount;
        hideLikes  = typeof showCount === "boolean" ? !showCount : false;
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
      gender: p.gender,             // الرمز فقط سيُعرض في PeerOverlay
      avatarUrl: p.avatarUrl,
      displayName: p.displayName,
      vip: p.vip,
      likes: 0,
      hideCountry: !!p.hideCountry,
      hideCity: !!p.hideCity,
      hideLikes: !!p.hideLikes,
    };
  }

  /* ---------- send meta with throttle ---------- */
  let lastSend = 0;
  async function sendMyMeta() {
    try {
      const room: any = (window as any).__lkRoom;
      if (!room?.localParticipant?.publishData) return;
      const now = Date.now();
      if (now - lastSend < 400) return; // كبح
      lastSend = now;
      const bin = new TextEncoder().encode(JSON.stringify({ t: "peer-meta", payload: composeMyMeta() }));
      await room.localParticipant.publishData(bin, { reliable: true, topic: "meta" });
    } catch {}
  }

  /* ---------- wiring ---------- */
  let curRoom: any = null;
  let off: (() => void) | null = null;

  function detach() { try { off?.(); } catch {} ; off = null; curRoom = null; }

  function attach(room: any) {
    if (!room?.on || curRoom === room) return;
    detach();
    curRoom = room;

    const onData = (payload: Uint8Array, _p?: any, _k?: any, topic?: string) => {
      // نقبل meta topic أو أي جسم يحمل مفاتيح الميتا المتوقعة
      const j = toJSON(payload);
      if (!j || typeof j !== "object") return;

      const looksLikeMetaBody =
        !!(j.gender || j.country || j.city || j.displayName || j.avatar || j.avatarUrl);

      const isMetaTopic = topic === "meta";
      const isMetaMsg   = j.t === "peer-meta" || j.t === "meta:init" || looksLikeMetaBody;

      if (!(isMetaTopic || isMetaMsg)) return;

      if (j.t === "peer-meta" && j.payload) {
        fire("ditona:peer-meta", { ...j.payload, pairId: pairId() });
        return;
      }
      if (j.t === "meta:init") {
        fire("ditona:meta:init", {});
        // أرسل مرتين لضمان الوصول
        sendMyMeta();
        setTimeout(sendMyMeta, 250);
        return;
      }
      if (!j.t && looksLikeMetaBody) {
        fire("ditona:peer-meta", { ...j, pairId: pairId() });
      }
    };

    // بدون استيراد RoomEvent
    room.on("dataReceived", onData);
    off = () => { try { room.off("dataReceived", onData); } catch {} };
  }

  attach((window as any).__lkRoom);

  // ربط تلقائي عند تبدّل الغرفة أو طلب المزامنة
  window.addEventListener("lk:attached", () => attach((window as any).__lkRoom) as any, { passive: true } as any);
  window.addEventListener("ditona:meta:init", () => { sendMyMeta(); } as any, { passive: true } as any);
  window.addEventListener("ditona:meta:push", () => { sendMyMeta(); } as any, { passive: true } as any);

  // تنظيف عند مغادرة الصفحة
  window.addEventListener("pagehide", () => { detach(); } as any, { once: true } as any);
}
export {};
