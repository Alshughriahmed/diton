"use client";
import { useEffect, useState } from "react";

type Meta = {
  country?: string;
  city?: string;
  gender?: string; // "male" | "female" | "couple" | "lgbt"
  avatarUrl?: string;
  likes?: number;
};

function genderBadge(g?: string) {
  const x = (g || "").toLowerCase();
  if (x.startsWith("male") || x === "m") return { label: "Male ♂️", cls: "text-blue-800" };
  if (x.startsWith("female") || x === "f") return { label: "Female ♀️", cls: "text-red-600" };
  if (x.includes("couple")) return { label: "Couple 👨‍❤️‍👨", cls: "text-red-500" };
  if (x.includes("lgbt") || x.includes("rainbow") || x.includes("gay"))
    return { label: "LGBT 🏳️‍🌈", cls: "bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent" };
  return null;
}

export default function PeerOverlay() {
  const [meta, setMeta] = useState<Meta>({});
  const [likes, setLikes] = useState<number>(0);

  useEffect(() => {
    const onMeta = (ev: any) => {
      const d = ev?.detail || {};
      setMeta({
        country: d.country || d.ctry || d.countryCode || "",
        city: d.city || d.town || "",
        gender: (d.gender || d.g || "").toLowerCase(),
        avatarUrl: d.avatar || d.photo || d.avatarUrl || "",
        likes: typeof d.likes === "number" ? d.likes : likes,
      });
      if (typeof d.likes === "number") setLikes(d.likes);
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
  }, [likes]);

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

      {/* Bottom-left: country–city + gender text, fully transparent background */}
      <div className="absolute bottom-2 left-2 z-30 text-xs sm:text-sm font-medium select-none pointer-events-none drop-shadow">
        <span className="text-white/95">
          {meta.country || meta.city ? `${meta.country ?? ""}${meta.city ? "–" + meta.city : ""}` : ""}
        </span>
        {g && <span className={"ml-2 " + g.cls}>{g.label}</span>}
      </div>
    </>
  );
}
