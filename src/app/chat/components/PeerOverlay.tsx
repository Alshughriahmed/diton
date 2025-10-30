"use client";

import { useEffect, useState } from "react";
import { normalizeGender, genderLabel } from "@/lib/gender";

type Meta = {
  did?: string;
  country?: string;
  city?: string;
  gender?: string;          // m|f|c|l|u أو رمز
  avatarUrl?: string;
  likes?: number;
  displayName?: string;
  vip?: boolean;            // true → 👑 ، false → 🚫👑
  hideLikes?: boolean;
  hideCountry?: boolean;
  hideCity?: boolean;
  pairId?: string | null;   // للحارس
};

function loadCached(): Meta {
  try {
    const w: any = globalThis as any;
    if (w.__ditonaLastPeerMeta && typeof w.__ditonaLastPeerMeta === "object") return w.__ditonaLastPeerMeta;
    const raw = sessionStorage.getItem("ditona:last_peer_meta");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function shallowEq(a: Meta, b: Meta) {
  return (
    a.did === b.did &&
    a.country === b.country &&
    a.city === b.city &&
    a.gender === b.gender &&
    a.avatarUrl === b.avatarUrl &&
    a.displayName === b.displayName &&
    !!a.vip === !!b.vip &&
    !!a.hideLikes === !!b.hideLikes &&
    !!a.hideCountry === !!b.hideCountry &&
    !!a.hideCity === !!b.hideCity
  );
}

function genderBadge(g: unknown): { symbol: string; label: string; symbolCls: string; labelCls: string } | null {
  const n = normalizeGender(g);
  if (n === "u") return null;
  const BIG = "text-[22px] md:text-[28px] leading-none"; // أكبر من السابق ~الضعف على الهاتف
  switch (n) {
    case "m":
      return { symbol: "♂", label: genderLabel(n), symbolCls: `text-blue-500 ${BIG}`, labelCls: "text-blue-500" };
    case "f":
      return { symbol: "♀", label: genderLabel(n), symbolCls: `text-red-500 ${BIG}`, labelCls: "text-red-500" };
    case "c":
      return { symbol: "⚤", label: genderLabel(n), symbolCls: `text-red-700 ${BIG}`, labelCls: "text-red-700" };
    case "l":
      // إبقاء الراية كما هي بألوان قوس قزح
      return {
        symbol: "🏳️‍🌈",
        label: "LGBTQ+",
        symbolCls: `${BIG}`,
        labelCls:
          "bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 bg-clip-text text-transparent"
      };
  }
  return null;
}

function curPair(): string | null {
  try {
    const w: any = globalThis as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

export default function PeerOverlay() {
  const [meta, setMeta] = useState<Meta>(loadCached());
  const [likes, setLikes] = useState<number>(typeof meta.likes === "number" ? meta.likes! : 0);

  useEffect(() => {
    function save(m: Meta) {
      try {
        (globalThis as any).__ditonaLastPeerMeta = m;
        sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(m));
      } catch {}
    }

    const onMeta = (ev: any) => {
      const d = ev?.detail || {};
      // حارس الزوج الحالي
      const pidNow = curPair();
      if (d?.pairId && pidNow && d.pairId !== pidNow) return;

      const next: Meta = {
        did: d.did || d.peerDid || d.id || d.identity || meta.did,
        country: d.country ?? meta.country,
        city: d.city ?? meta.city,
        gender: d.gender ?? meta.gender,
        avatarUrl: d.avatarUrl ?? d.avatar ?? meta.avatarUrl,
        likes: typeof d.likes === "number" ? d.likes : likes,
        displayName: d.displayName ?? d.name ?? meta.displayName,
        vip: !!(d.vip ?? d.isVip ?? d.premium ?? d.pro ?? meta.vip),
        hideLikes: !!(d.hideLikes ?? meta.hideLikes),
        hideCountry: !!(d.hideCountry ?? meta.hideCountry),
        hideCity: !!(d.hideCity ?? meta.hideCity),
        pairId: pidNow,
      };

      // ثبت __peerDid لاستخدام API like
      try {
        const w: any = globalThis as any;
        if (next.did) {
          w.__peerDid = next.did;
          w.__ditonaPeerDid = next.did;
        }
      } catch {}

      if (!shallowEq(meta, next)) {
        setMeta(next);
        save(next);
      }

      if (typeof next.likes === "number") {
        const nv = Math.max(0, Number(next.likes) || 0);
        if (nv !== likes) setLikes(nv);
      }
    };

    const onLikeSync = (ev: any) => {
      const d = ev?.detail || {};
      const pidNow = curPair();
      if (d?.pairId && pidNow && d.pairId !== pidNow) return;
      const n = typeof d.count === "number" ? d.count : typeof d.likes === "number" ? d.likes : null;
      if (n != null) {
        const nv = Math.max(0, Number(n) || 0);
        setLikes((p) => (nv !== p ? nv : p));
      }
    };

    const resetAll = () => {
      const cleared: Meta = {};
      setMeta(cleared);
      setLikes(0);
      try {
        const w: any = globalThis as any;
        delete w.__peerDid;
        delete w.__ditonaPeerDid;
        sessionStorage.removeItem("ditona:last_peer_meta");
        w.__ditonaLastPeerMeta = {};
      } catch {}
    };

    const onPhase = (ev: any) => {
      const ph = ev?.detail?.phase;
      if (ph === "searching" || ph === "stopped" || ph === "idle" || ph === "boot") resetAll();
    };

    const ask = () => {
      try {
        const room: any = (globalThis as any).__lkRoom;
        if (room?.state === "connected") {
          const payload = new TextEncoder().encode(JSON.stringify({ t: "meta:init" }));
          room.localParticipant?.publishData?.(payload, { reliable: true, topic: "meta" });
        }
      } catch {}
    };

    window.addEventListener("ditona:peer-meta", onMeta as any);
    window.addEventListener("rtc:peer-meta", onMeta as any);
    window.addEventListener("like:sync", onLikeSync as any);
    window.addEventListener("rtc:phase", onPhase as any);
    window.addEventListener("rtc:pair", () => {} as any);
    window.addEventListener("lk:attached", ask as any, { passive: true } as any);

    const t = setTimeout(ask, 500);

    return () => {
      clearTimeout(t);
      window.removeEventListener("ditona:peer-meta", onMeta as any);
      window.removeEventListener("rtc:peer-meta", onMeta as any);
      window.removeEventListener("like:sync", onLikeSync as any);
      window.removeEventListener("rtc:phase", onPhase as any);
      window.removeEventListener("rtc:pair", () => {} as any);
      window.removeEventListener("lk:attached", ask as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = genderBadge(meta.gender);
  const showLoc = !(meta.hideCountry || meta.hideCity);

  const countryText = showLoc ? (meta.country || "") : "";
  const cityText = showLoc ? (meta.city || "") : "";
  const locText = countryText || cityText ? `${countryText}${cityText ? "–" + cityText : ""}` : "";

  return (
    <>
      {/* أعلى اليسار: صورة B + عداد لايك + VIP كرموز 👑/🚫👑 */}
      <div className="absolute top-2 left-2 z-40 flex items-center gap-2 select-none pointer-events-none">
        <div
          data-ui="peer-avatar"
          className="h-9 w-9 rounded-full overflow-hidden ring-1 ring-white/30 bg-white/10 bg-center bg-cover"
          style={{ backgroundImage: meta.avatarUrl ? `url("${meta.avatarUrl}")` : undefined }}
          aria-hidden="true"
        >
          {!meta.avatarUrl && (
            <div className="h-full w-full grid place-items-center text-[10px] text-white/80 bg-black/30">?</div>
          )}
        </div>

        <div className="flex items-center gap-1 text-white/95 drop-shadow">
          <span className="text-xs font-medium" data-ui="peer-name">{meta.displayName || ""}</span>
          <span className="ml-2 text-sm">❤️</span>
          <span className="text-xs" data-ui="peer-likes">{Math.max(0, likes | 0)}</span>
          <span className="ml-2 text-xs">
            {meta.vip ? "👑" : "🚫👑"}
          </span>
        </div>
      </div>

      {/* أسفل اليسار: الموقع + شارة الجنس بالألوان المحددة */}
      <div className="absolute bottom-2 left-2 z-40 text-xs sm:text-sm font-medium select-none pointer-events-none drop-shadow">
        <span className="text-white/95">{locText}</span>
        <span className="sr-only" aria-hidden="true" data-ui="peer-country">{countryText}</span>
        <span className="sr-only" aria-hidden="true" data-ui="peer-city">{cityText}</span>

        <span className="inline-flex items-center gap-2 ml-3 align-middle">
          <span className={g ? g.symbolCls : "text-white/70"} data-ui="peer-gender">{g ? g.symbol : ""}</span>
          {g && <span className={g.labelCls}>{g.label}</span>}
        </span>
      </div>
    </>
  );
}
