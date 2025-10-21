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

/** Badge data with larger symbol size. Couples symbol overridden to ⚤. */
function genderBadgeLocal(
  g: unknown
): { symbol: string; label: string; labelCls: string; symbolCls: string } | null {
  const n = normalizeGender(g);
  if (n === "u") return null;

  const label = genderLabel(n);
  const BIG = "text-[1.25rem] sm:text-[1.5rem] leading-none"; // bigger symbol only

  switch (n) {
    case "m":
      return { symbol: "♂", label, labelCls: "text-blue-500", symbolCls: `text-blue-500 ${BIG}` };
    case "f":
      return { symbol: "♀", label, labelCls: "text-red-500", symbolCls: `text-red-500 ${BIG}` };
    case "c":
      // override to ⚤, keep couples color
      return { symbol: "⚤", label, labelCls: "text-rose-400", symbolCls: `text-rose-400 ${BIG}` };
    case "l":
      // rainbow gradient for both symbol and label
      const GRAD = "bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 bg-clip-text text-transparent";
      return { symbol: "🏳️‍🌈", label: "LGBTQ+", labelCls: GRAD, symbolCls: `${GRAD} ${BIG}` };
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
      };
      setMeta(merged);
      if (typeof merged.likes === "number") setLikes(merged.likes);
      save(merged);
    };

    const onLike = (ev: any) => {
      const n = ev?.detail?.likes ?? ev?.detail?.count;
      if (typeof n === "number") setLikes(n);
      else setLikes((x) => x + 1);
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
    window.addEventListener("ditona:like:recv", onLike as any);
    window.addEventListener("rtc:phase", onPhase as any);
    window.addEventListener("rtc:pair", onPair as any);

    // ask once if nothing arrived
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
      window.removeEventListener("ditona:like:recv", onLike as any);
      window.removeEventListener("rtc:phase", onPhase as any);
      window.removeEventListener("rtc:pair", onPair as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = genderBadgeLocal(meta.gender);

  return (
    <>
      {/* Top-left: avatar + name + VIP + likes */}
      <div className="absolute top-2 left-2 z-30 flex items-center gap-2 select-none pointer-events-none">
        <div className="h-7 w-7 rounded-full overflow-hidden ring-1 ring-white/30 bg-white/10">
          {meta.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meta.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-[10px] text-white/80 bg-black/30">?</div>
          )}
        </div>
        <div className="flex items-center gap-1 text-white/95 drop-shadow">
          {meta.displayName && <span className="text-xs font-medium">{meta.displayName}</span>}
          {meta.vip && <span className="text-[10px] px-1 rounded-full bg-yellow-400/90 text-black font-bold">VIP</span>}
          <span className="ml-1 text-sm">♥</span>
          <span className="text-xs">{likes}</span>
        </div>
      </div>

      {/* Bottom-left: Country–City + gender badge (bigger symbol only) */}
      <div className="absolute bottom-2 left-2 z-30 text-xs sm:text-sm font-medium select-none pointer-events-none drop-shadow">
        <span className="text-white/95">
          {meta.country || meta.city ? `${meta.country ?? ""}${meta.city ? "–" + meta.city : ""}` : ""}
        </span>
        {g && (
          <span className="ml-2 inline-flex items-center gap-1 align-middle">
            <span className={g.symbolCls} aria-hidden>
              {g.symbol}
            </span>
            <span className={g.labelCls}>{g.label}</span>
          </span>
        )}
      </div>
    </>
  );
}
