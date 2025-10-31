"use client";

import { useEffect, useState } from "react";

type PeerMeta = {
  displayName?: string;
  vip?: boolean;
  likes?: number;
  hideLikes?: boolean;
  country?: string;
  hideCountry?: boolean;
  city?: string;
  hideCity?: boolean;
  gender?: string;
  avatar?: string;
  avatarUrl?: string;
  pairId?: string | null;
};

function curPair(): string | null {
  try {
    const w: any = window as any;
    return w.__ditonaPairId || w.__pairId || null;
  } catch {
    return null;
  }
}

const norm = (g: unknown) => {
  const s = String(g ?? "").toLowerCase().trim();
  if (s === "m" || s.startsWith("male") || s.includes("♂")) return "m";
  if (s === "f" || s.startsWith("fem") || s.includes("♀")) return "f";
  if (s === "c" || s.includes("couple") || s.includes("paar")) return "c";
  if (s === "l" || s.includes("lgbt") || s.includes("rainbow")) return "l";
  return "u";
};
const sym = (n: string) => (n === "m" ? "♂" : n === "f" ? "♀" : n === "c" ? "⚤" : n === "l" ? "🏳️‍🌈" : "");
const colorCls = (n: string) =>
  n === "m" ? "text-blue-500" : n === "f" ? "text-red-500" : n === "c" ? "text-red-700" : ""; // LGBTQ: كما هو

export default function PeerOverlay() {
  const [meta, setMeta] = useState<PeerMeta>({});

  useEffect(() => {
    // ملء فوري من الكاش عند الإقلاع
    try {
      const raw = sessionStorage.getItem("ditona:last_peer_meta");
      if (raw) setMeta(JSON.parse(raw));
    } catch {}

    // تحديث حي من القناة مع Pair guard
    const onMeta = (e: any) => {
      const d = (e?.detail || {}) as PeerMeta;
      const pid = d?.pairId || curPair();
      if (pid && curPair() && pid !== curPair()) return; // Pair guard
      setMeta(d);
    };
    window.addEventListener("ditona:peer-meta", onMeta as any);

    // مسح البطاقة عند مراحل البحث/التوقف
    const onPhase = (e: any) => {
      const ph = e?.detail?.phase;
      if (ph === "boot" || ph === "idle" || ph === "searching" || ph === "stopped") setMeta({});
    };
    window.addEventListener("rtc:phase", onPhase as any);

    // مزامنة عداد الإعجابات
    const onLikeSync = (e: any) => {
      const d = e?.detail || {};
      const pid = d?.pairId || curPair();
      if (pid && curPair() && pid !== curPair()) return;
      if (typeof d.count === "number") setMeta((m) => ({ ...m, likes: d.count }));
    };
    window.addEventListener("like:sync", onLikeSync as any);

    return () => {
      window.removeEventListener("ditona:peer-meta", onMeta as any);
      window.removeEventListener("rtc:phase", onPhase as any);
      window.removeEventListener("like:sync", onLikeSync as any);
    };
  }, []);

  const gNorm = norm(meta.gender);
  const genderSym = sym(gNorm);
  const genderColor = colorCls(gNorm);
  const likesText = meta?.hideLikes ? "" : typeof meta?.likes === "number" ? `❤️ ${meta.likes}` : "";

  const avatarUrl = meta?.avatarUrl || meta?.avatar || "";

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* أعلى يسار: أفاتار (bg-cover) + اسم + VIP + الإعجابات */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <div
          data-ui="peer-avatar"
          aria-hidden
          className="h-6 w-6 rounded-full ring-1 ring-white/20 bg-center bg-cover"
          style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
        />
        <span data-ui="peer-name" className="text-white/90 text-sm font-semibold">{meta?.displayName || ""}</span>
        <span data-ui="peer-vip" className="text-yellow-400 text-xs font-semibold">
          {typeof meta?.vip === "boolean" ? (meta.vip ? "👑" : "🚫👑") : ""}
        </span>
        <span data-ui="peer-likes" className="text-pink-400 text-sm font-semibold">{likesText}</span>
      </div>

      {/* أسفل يسار: البلد + المدينة + الجنس (رمز فقط بألوان وحجم محدد) */}
      <div className="absolute left-3 bottom-3 flex items-center gap-2">
        <span data-ui="peer-country" className="text-white/80 text-sm">{meta?.hideCountry ? "" : meta?.country || ""}</span>
        <span data-ui="peer-city" className="text-white/60 text-sm">{meta?.hideCity ? "" : meta?.city || ""}</span>
        <span data-ui="peer-gender" className={`font-semibold leading-none text-[22px] md:text-[28px] ${genderColor}`}>{genderSym}</span>
      </div>
    </div>
  );
}
