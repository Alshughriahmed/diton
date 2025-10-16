"use client";
import { useEffect, useState } from "react";

type Meta = {
  country?: string;
  city?: string;
  gender?: string;
  avatarUrl?: string;
  likes?: number;
};

function normGender(v: any): "male" | "female" | "couple" | "lgbt" | null {
  const s = String(v ?? "").trim().toLowerCase();

  if (!s) return null;
  // direct words / letters
  if (s === "m" || s.startsWith("male") || s.includes("man") || s.includes("boy")) return "male";
  if (s === "f" || s.startsWith("female") || s.includes("woman") || s.includes("girl")) return "female";
  if (s === "c" || s.includes("couple") || s.includes("pair")) return "couple";
  if (s.includes("lgbt") || s.includes("rainbow") || s.includes("gay") || s.includes("pride")) return "lgbt";

  // emoji/symbols inside any string
  if (s.includes("♂")) return "male";
  if (s.includes("♀")) return "female";
  if (s.includes("👨") || s.includes("👩")) return "couple";
  if (s.includes("🏳️‍🌈")) return "lgbt";

  return null;
}

function genderBadge(g?: string) {
  const t = normGender(g);
  if (t === "male") return { label: "Male ♂️", cls: "text-blue-800" };           // أزرق غامق
  if (t === "female") return { label: "Female ♀️", cls: "text-red-600" };        // أحمر فاقع
  if (t === "couple") return { label: "Couple 👨‍❤️‍👨", cls: "text-red-500" };   // أحمر فاتح
  if (t === "lgbt")
    return {
      label: "LGBT 🏳️‍🌈",
      cls: "bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent",
    };
  return null;
}

export default function PeerOverlay() {
  const [meta, setMeta] = useState<Meta>({});
  const [likes, setLikes] = useState<number>(0);

  useEffect(() => {
    const onMeta = (ev: any) => {
      const d = ev?.detail || {};
      const genderRaw =
        d.gender ?? d.sex ?? d.g ?? d.s ?? d.genderEmoji ?? d.gender_symbol ?? d.genderSymbol ?? d.genderCode;

      setMeta({
        country: d.country ?? d.ctry ?? d.countryName ?? d.cc ?? d.cn ?? "",
        city: d.city ?? d.town ?? d.locality ?? d.ci ?? "",
        gender: genderRaw,
        avatarUrl: d.avatar ?? d.photo ?? d.avatarUrl ?? "",
      });

      const likeIn = d.likes ?? d.likeCount ?? d.hearts ?? d.heartCount;
      if (typeof likeIn === "number") setLikes(likeIn);
    };

    const onLike = (ev: any) => {
      const n = ev?.detail?.likes ?? ev?.detail?.count;
      if (typeof n === "number") setLikes(n);
      else setLikes((x) => x + 1);
    };

    window.addEventListener("ditona:peer-meta", onMeta as any);
    window.addEventListener("ditona:like:recv", onLike as any);
    return () => {
      window.removeEventListener("ditona:peer-meta", onMeta as any);
      window.removeEventListener("ditona:like:recv", onLike as any);
    };
  }, []);

  const g = genderBadge(meta.gender);

  return (
    <>
      {/* Top-left: avatar + likes, no box */}
      <div className="absolute top-2 left-2 z-30 flex items-center gap-2 select-none pointer-events-none">
        <div className="h-8 w-8 rounded-full overflow-hidden ring-1 ring-white/30 bg-white/10">
          {meta.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meta.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-xs text-white/80 bg-black/30">?</div>
          )}
        </div>
        <div className="flex items-center gap-1 text-white drop-shadow">
          <span className="text-base">♥</span>
          <span className="text-sm">{likes}</span>
        </div>
      </div>

      {/* Bottom-left: Country–City + gender */}
      <div className="absolute bottom-2 left-2 z-30 text-xs sm:text-sm font-medium select-none pointer-events-none drop-shadow">
        <span className="text-white/95">
          {meta.country || meta.city ? `${meta.country ?? ""}${meta.city ? "–" + meta.city : ""}` : ""}
        </span>
        {g && <span className={"ml-2 " + g.cls}>{g.label}</span>}
      </div>
    </>
  );
}
