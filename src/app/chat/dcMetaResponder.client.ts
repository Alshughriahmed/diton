// src/app/chat/dcMetaResponder.client.ts
/**
 * DataChannel peer meta bridge.
 * يطبع الحقول ويوحّدها ثم يرسل: {displayName, avatarUrl, vip, country, city, gender, likes}
 * يستقبل peer-meta ويمرّره إلى واجهات العرض.
 */

if (typeof window !== "undefined" && !(window as any).__dcMetaResponderMounted) {
  (window as any).__dcMetaResponderMounted = 1;

  const normGender = (v: any): "male" | "female" | "couple" | "lgbt" | undefined => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return;
    if (s === "m" || s.startsWith("male") || s.includes("man") || s.includes("boy") || s.includes("♂")) return "male";
    if (s === "f" || s.startsWith("female") || s.includes("woman") || s.includes("girl") || s.includes("♀")) return "female";
    if (s === "c" || s.includes("couple") || s.includes("pair") || s.includes("👨") || s.includes("👩")) return "couple";
    if (s.includes("lgbt") || s.includes("rainbow") || s.includes("pride") || s.includes("gay") || s.includes("🏳️‍🌈")) return "lgbt";
    if (s.includes("ذكر")) return "male";
    if (s.includes("أنث") || s.includes("انث")) return "female";
    if (s.includes("زوج")) return "couple";
    if (s.includes("مثلي")) return "lgbt";
    return;
  };

  const coalesce = <T = any>(...vals: T[]) => {
    for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== "") return v as any;
    return undefined;
  };

  const readGeo = () => {
    try {
      const raw = localStorage.getItem("ditona_geo");
      if (!raw) return {};
      const g = JSON.parse(raw);
      return {
        country: coalesce(g.country, g.countryName, g.ctry, g.cn, g.cc),
        city: coalesce(g.city, g.town, g.locality),
      };
    } catch { return {}; }
  };

  const readProfile = () => {
    try {
      const w: any = window as any;
      const fromWindow = w.__ditonaProfile || {};
      const ls =
        JSON.parse(localStorage.getItem("ditona_profile") || "null") ||
        JSON.parse(localStorage.getItem("profile") || "null") || {};
      const genderRaw = coalesce(fromWindow.gender, ls.gender, localStorage.getItem("ditona_gender"));
      return {
        displayName: coalesce(fromWindow.displayName, ls.displayName, ls.name, ls.username),
        avatarUrl: coalesce(fromWindow.avatarUrl, ls.avatarUrl, ls.avatar, ls.photo),
        vip: !!coalesce(fromWindow.isVip, fromWindow.vip, ls.isVip, ls.vip, ls.premium, ls.pro),
        gender: normGender(genderRaw),
      };
    } catch { return {}; }
  };

  const readLikes = () => {
    try {
      const n = Number(localStorage.getItem("ditona_like_count") || "0");
      return Number.isFinite(n) ? n : 0;
    } catch { return 0; }
  };

  const buildLocalMeta = () => {
    const geo = readGeo();
    const prof = readProfile();
    const likes = readLikes();
    return {
      country: geo.country,
      city: geo.city,
      gender: prof.gender,
      displayName: prof.displayName,
      avatarUrl: prof.avatarUrl,
      vip: !!prof.vip,
      likes,
    };
  };

  const sendOverDC = async (obj: any) => {
    try {
      const txt = JSON.stringify(obj);
      const room = (window as any).__lkRoom;
      if (room && room.state === "connected" && room.localParticipant?.publishData) {
        const bin = new TextEncoder().encode(txt);
        await room.localParticipant.publishData(bin, { reliable: true, topic: "meta" });
        return true;
      }
      const dc = (window as any).__ditonaDataChannel;
      if (dc?.send) { dc.send(txt); return true; }
    } catch {}
    return false;
  };

  const onDCMessage = (ev: MessageEvent) => {
    try {
      const d = ev?.data;
      let s: string | null = null;
      if (typeof d === "string") s = d;
      else if (d instanceof ArrayBuffer) s = new TextDecoder().decode(new Uint8Array(d));
      else if (ArrayBuffer.isView(d)) s = new TextDecoder().decode(d as any);
      if (!s || !/^\s*\{/.test(s)) return;

      const j = JSON.parse(s);

      // تمرير ميتا الطرف الآخر إلى الواجهة
      if ((j?.t === "peer-meta" || j?.type === "peer-meta") && j?.payload) {
        window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: j.payload }));
        return;
      }

      // طلب تهيئة الميتا
      if (j?.t === "meta:init" || j?.type === "meta:init") {
        const payload = buildLocalMeta();
        sendOverDC({ t: "peer-meta", payload });
        return;
      }
    } catch {}
  };

  try {
    const dc = (window as any).__ditonaDataChannel;
    dc?.addEventListener?.("message", onDCMessage);
    dc?.setSendGuard?.(() => {
      const room = (window as any).__lkRoom;
      return !!room && room.state === "connected";
    });
  } catch {}

  // إعادة إرسال الميتا تلقائيًا بعد الاتصال أو عند بدء وصول الفيديو
  const triggerMetaInit = () => {
    const payload = buildLocalMeta();
    sendOverDC({ t: "peer-meta", payload });
  };
  window.addEventListener("rtc:remote-track", triggerMetaInit as any);
  window.addEventListener("rtc:phase", (e: any) => {
    if (e?.detail?.phase === "connected") triggerMetaInit();
  });

  window.addEventListener(
    "pagehide",
    () => {
      try {
        const dc = (window as any).__ditonaDataChannel;
        dc?.removeEventListener?.("message", onDCMessage);
      } catch {}
    },
    { once: true }
  );
}

export {};
