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
};

const norm = (g: unknown) => {
  const s = String(g ?? "").toLowerCase().trim();
  if (s === "m" || s.startsWith("male") || s.includes("♂")) return "m";
  if (s === "f" || s.startsWith("fem") || s.includes("♀")) return "f";
  if (s === "c" || s.includes("couple") || s.includes("paar")) return "c";
  if (s === "l" || s.includes("lgbt") || s.includes("rainbow")) return "l";
  return "u";
};
const sym = (n: string) => (n === "m" ? "♂" : n === "f" ? "♀" : n === "c" ? "👫" : n === "l" ? "🏳️‍🌈" : "");

export default function PeerOverlay() {
  const [meta, setMeta] = useState<PeerMeta>({});

  useEffect(() => {
    // ملء فوري من الكاش
    try {
      const raw = sessionStorage.getItem("ditona:last_peer_meta");
      if (raw) setMeta(JSON.parse(raw));
    } catch {}

    // تحديث حي من القناة
    const onMeta = (e: any) => {
      const d = (e?.detail || {}) as PeerMeta;
      setMeta(d);
    };
    window.addEventListener("ditona:peer-meta", onMeta as any);

    return () => window.removeEventListener("ditona:peer-meta", onMeta as any);
  }, []);

  const genderSym = sym(norm(meta.gender));
  const likesText =
    meta?.hideLikes ? "" : typeof meta?.likes === "number" ? `♥ ${meta.likes}` : "";

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* أعلى يسار: أفاتار + اسم + VIP + الإعجابات */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <img
          data-ui="peer-avatar"
          alt=""
          className="h-6 w-6 rounded-full object-cover ring-1 ring-white/20"
          // لا نُخفي الصورة؛ إن لم يوجد src ستظهر كحاوية فارغة صغيرة — سلوك مقبول
          src={meta?.avatar || undefined}
          draggable={false}
        />
        <span data-ui="peer-name" className="text-white/90 text-sm font-semibold">
          {meta?.displayName || ""}
        </span>
        <span data-ui="peer-vip" className="text-yellow-400 text-xs font-semibold">
          {meta?.vip ? "VIP" : ""}
        </span>
        <span data-ui="peer-likes" className="text-pink-400 text-sm font-semibold">
          {likesText}
        </span>
      </div>

      {/* أسفل يسار: البلد + المدينة + الجنس (رمز فقط) */}
      <div className="absolute left-3 bottom-3 flex items-center gap-2">
        <span data-ui="peer-country" className="text-white/80 text-sm">
          {meta?.hideCountry ? "" : meta?.country || ""}
        </span>
        <span data-ui="peer-city" className="text-white/60 text-sm">
          {meta?.hideCity ? "" : meta?.city || ""}
        </span>
        {/* تكبير واضح على الهاتف */}
        <span
          data-ui="peer-gender"
          className="text-white/90 font-semibold text-[22px] sm:text-[26px] leading-none"
        >
          {genderSym}
        </span>
      </div>
    </div>
  );
}
