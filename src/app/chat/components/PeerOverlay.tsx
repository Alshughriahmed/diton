// src/app/chat/components/PeerOverlay.tsx
"use client";

import { useEffect, useState } from "react";
import { normalizeGender, genderLabel } from "@/lib/gender";

type Meta = {
  did?: string;
  country?: string;
  city?: string;
  gender?: string;
  avatarUrl?: string;
  likes?: number;
  displayName?: string;
  vip?: boolean;
  hideLikes?: boolean;
  hideCountry?: boolean;
  hideCity?: boolean;
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

function genderBadgeLocal(
  g: unknown,
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
      };

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
        setLikes((prev) => (nv !== prev ? nv : prev));
      }
    };

    const onLikeSync = (ev: any) => {
      const d = ev?.detail || {};
      const cp = curPair();
      if (d?.pairId && cp && d.pairId !== cp) return;
      const n = typeof d.count === "number" ? d.count : typeof d.likes === "number" ? d.likes : null;
      if (n != null) {
        const nv = Math.max(0, Number(n) || 0);
        setLikes((p) => (nv !== p ? nv : p));
      }
    };

    const resetAll = () => {
      setMeta({});
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
      if (ph === "searching" || ph === "stopped") resetAll();
    };

    // طلب meta فور attach ونسخة احتياطية بعد ثانية
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
    window.addEventListener("rtc:pair", resetAll as any);
    window.addEventListener("lk:attached", ask as any, { passive: true } as any);

    const t = setTimeout(ask, 1000);

    return () => {
      clearTimeout(t);
      window.removeEventListener("ditona:peer-meta", onMeta as any);
      window.removeEventListener("rtc:peer-meta", onMeta as any);
      window.removeEventListener("like:sync", onLikeSync as any);
      window.removeEventListener("rtc:phase", onPhase as any);
      window.removeEventListener("rtc:pair", resetAll as any);
      window.removeEventListener("lk:attached", ask as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = genderBadgeLocal(meta.gender);
  const showLoc = !(meta.hideCountry || meta.hideCity);
  const showLikes = !meta.hideLikes;

  return (
    <>
      {/* أعلى اليسار */}
      <div className="absolute top-2 left-2 z-30 flex items-center gap-2 select-none pointer-events-none">
        {/* نحرص على وجود <img data-ui="peer-avatar"> دائمًا كي يعمل peerMetaUi */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-ui="peer-avatar"
          src={meta.avatarUrl || ""}
          alt=""
          className="h-8 w-8 rounded-full overflow-hidden ring-1 ring-white/30 object-cover bg-white/10"
          onError={(e) => {
            const el = e.currentTarget;
            el.removeAttribute("src");
            el.style.display = "none";
          }}
        />
        <div className="flex items-center gap-1 text-white/95 drop-shadow">
          <span className="text-xs font-medium" data-ui="peer-name">
            {meta.displayName || ""}
          </span>
          <span
            data-ui="peer-vip"
            className={`text-[10px] px-1 rounded-full ${meta.vip ? "bg-yellow-400/90 text-black font-bold" : "hidden"}`}
          >
            VIP
          </span>
          {showLikes && (
            <>
              <span className="ml-1 text-sm">❤️</span>
              <span className="text-xs" data-ui="peer-likes">
                {likes}
              </span>
            </>
          )}
        </div>
      </div>

      {/* أسفل اليسار */}
      <div className="absolute bottom-2 left-2 z-30 text-xs sm:text-sm font-medium select-none pointer-events-none drop-shadow">
        {showLoc && (
          <>
            <span className="text-white/95" data-ui="peer-country">
              {meta.country || "—"}
            </span>
            {/* city مطلوب للمحدّد، حتى لو مُخفى بصريًا */}
            <span className="sr-only" aria-hidden="true" data-ui="peer-city">
              {meta.city || ""}
            </span>
          </>
        )}
        {g ? (
          <span className="inline-flex items-center gap-1 ml-2 align-middle">
            <span className={g.symbolCls} data-ui="peer-gender">
              {g.symbol}
            </span>
            <span className={g.labelCls}>{g.label}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 ml-2 align-middle">
            <span className="text-white/70" data-ui="peer-gender">
              —
            </span>
          </span>
        )}
      </div>
    </>
  );
}
