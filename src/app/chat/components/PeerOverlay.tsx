// src/app/chat/components/PeerOverlay.tsx
"use client";

import { useEffect, useState } from "react";
import { normalizeGender, genderLabel } from "@/lib/gender";

type Meta = {
  country?: string;
  city?: string;
  gender?: string;
  avatarUrl?: string;
  likes?: number;
  displayName?: string;
  vip?: boolean;
  hideLikes?: boolean; // NEW
  hideCountry?: boolean; // NEW
  hideCity?: boolean; // NEW
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

/** Badge مع تكبير رمز الجنس. */
function genderBadgeLocal(
  g: unknown
): { symbol: string; label: string; labelCls: string; symbolCls: string } | null {
  const n = normalizeGender(g);
  if (n === "u") return null;
  const label = genderLabel(n);
  const BIG = "text-[1.25rem] sm:text-[1.5rem] leading-none";
  switch (n) {
    case "m":
      return { symbol: "♂", label, labelCls: "text-blue-500", symbolCls: `text-blue-500 ${BIG}` };
    case "f":
      return { symbol: "♀", label, labelCls: "text-red-500", symbolCls: `text-red-500 ${BIG}` };
    case "c":
      return { symbol: "⚤", label, labelCls: "text-rose-400", symbolCls: `text-rose-400 ${BIG}` };
    case "l": {
      const GRAD = "bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 bg-clip-text text-transparent";
      return { symbol: "🏳️‍🌈", label: "LGBTQ+", labelCls: GRAD, symbolCls: `${GRAD} ${BIG}` };
    }
    default:
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
      const merged: Meta = {
        country: d.country ?? meta.country,
        city: d.city ?? meta.city,
        gender: d.gender ?? meta.gender,
        avatarUrl: d.avatarUrl ?? d.avatar ?? meta.avatarUrl,
        likes: typeof d.likes === "number" ? d.likes : likes,
        displayName: d.displayName ?? d.name ?? meta.displayName,
        vip: !!(d.vip ?? d.isVip ?? d.premium ?? d.pro ?? meta.vip),
        hideLikes: !!(d.hideLikes ?? meta.hideLikes), // NEW
        hideCountry: !!(d.hideCountry ?? meta.hideCountry), // NEW
        hideCity: !!(d.hideCity ?? meta.hideCity), // NEW
      };
      setMeta(merged);
      if (typeof merged.likes === "number") setLikes(merged.likes);
      save(merged);
    };

    const onLikeSync = (ev: any) => {
      const d = ev?.detail || {};
      const curPair = (globalThis as any).__pairId || (globalThis as any).__ditonaPairId;
      if (d.pairId && curPair && d.pairId !== curPair) return;
      if (typeof d.count === "number") setLikes(Math.max(0, Number(d.count) || 0));
      else if (typeof d.likes === "number") setLikes(Math.max(0, Number(d.likes) || 0));
    };

    const onPhase = (ev: any) => {
      const ph = ev?.detail?.phase;
      if (ph === "searching" || ph === "matched" || ph === "stopped") {
        setMeta({});
        setLikes(0);
        try {
          sessionStorage.removeItem("ditona:last_peer_meta");
          (globalThis as any).__ditonaLastPeerMeta = {};
        } catch {}
      }
    };

    const onPair = () => {
      setMeta({});
      setLikes(0);
      try {
        sessionStorage.removeItem("ditona:last_peer_meta");
        (globalThis as any).__ditonaLastPeerMeta = {};
      } catch {}
    };

    window.addEventListener("ditona:peer-meta", onMeta as any);
    window.addEventListener("rtc:peer-meta", onMeta as any);
    window.addEventListener("like:sync", onLikeSync as any); // NEW
    window.addEventListener("rtc:phase", onPhase as any);
    window.addEventListener("rtc:pair", onPair as any);

    // طلب meta:init مرة إذا لم تصل بيانات
    const t = setTimeout(() => {
      try {
        const room: any = (globalThis as any).__lkRoom;
        if (room?.state === "connected") {
          const payload = new TextEncoder().encode(JSON.stringify({ t: "meta:init" }));
          room.localParticipant?.publishData?.(payload, { reliable: true, topic: "meta" });
        }
      } catch {}
    }, 1000);

    return () => {
      clearTimeout(t);
      window.removeEventListener("ditona:peer-meta", onMeta as any);
      window.removeEventListener("rtc:peer-meta", onMeta as any);
      window.removeEventListener("like:sync", onLikeSync as any); // NEW
      window.removeEventListener("rtc:phase", onPhase as any);
      window.removeEventListener("rtc:pair", onPair as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = genderBadgeLocal(meta.gender);
  const showLoc = !(meta.hideCountry || meta.hideCity); // NEW
  const showLikes = !meta.hideLikes; // NEW

  return (
    <>
      {/* أعلى اليسار: عنصر واحد فقط [avatar][name][VIP][♥][count] */}
      <div className="absolute top-2 left-2 z-30 flex items-center gap-2 select-none pointer-events-none">
        <div className="h-8 w-8 rounded-full overflow-hidden ring-1 ring-white/30 bg-white/10">
          {meta.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-full w-full grid place-items-center text-[10px] text-white/80 bg-black/30">?</div>
          )}
        </div>
        <div className="flex items-center gap-1 text-white/95 drop-shadow">
          {meta.displayName && <span className="text-xs font-medium">{meta.displayName}</span>}
          {meta.vip && <span className="text-[10px] px-1 rounded-full bg-yellow-400/90 text-black font-bold">VIP</span>}
          {showLikes && (
            <>
              <span className="ml-1 text-sm">❤</span>
              <span className="text-xs">{likes}</span>
            </>
          )}
        </div>
      </div>

      {/* أسفل اليسار: Country–City + Badge الجنس مع رمز أكبر */}
      <div className="absolute bottom-2 left-2 z-30 text-xs sm:text-sm font-medium select-none pointer-events-none drop-shadow">
        {showLoc && (
          <span className="text-white/95">
            {meta.country || meta.city ? `${meta.country ?? ""}${meta.city ? "–" + meta.city : ""}` : ""}
          </span>
        )}
        {g && (
          <span className="inline-flex items-center gap-1 ml-2 align-middle">
            <span className={g.symbolCls}>{g.symbol}</span>
            <span className={g.labelCls}>{g.label}</span>
          </span>
        )}
      </div>
    </>
  );
}
