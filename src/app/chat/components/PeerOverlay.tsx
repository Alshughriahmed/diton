"use client";
import { useEffect, useState } from "react";

type Meta = {
  country?: string;
  city?: string;
  gender?: string;
  avatarUrl?: string;
  likes?: number;
  displayName?: string;
  vip?: boolean;
};

function normGender(v: any): "male" | "female" | "couple" | "lgbt" | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;

  // English codes/words
  if (s === "m" || s.startsWith("male") || s.includes("man") || s.includes("boy")) return "male";
  if (s === "f" || s.startsWith("female") || s.includes("woman") || s.includes("girl")) return "female";
  if (s === "c" || s.includes("couple") || s.includes("pair")) return "couple";
  if (s.includes("lgbt") || s.includes("rainbow") || s.includes("pride") || s.includes("gay")) return "lgbt";

  // Symbols / emoji
  if (s.includes("♂")) return "male";
  if (s.includes("♀")) return "female";
  if (s.includes("👨") || s.includes("👩")) return "couple";
  if (s.includes("🏳️‍🌈")) return "lgbt";

  // Arabic common forms (حتى لو كان المحتوى إنكليزي قد تأتي من الإعدادات)
  if (s.includes("ذكر")) return "male";
  if (s.includes("انث") || s.includes("أنث")) return "female";
  if (s.includes("زوج")) return "couple";
  if (s.includes("مثلي")) return "lgbt";

  return null;
}

function genderBadge(g?: string) {
  const t = normGender(g);
  if (t === "male") return { label: "Male ♂️", cls: "text-blue-800" };              // أزرق غامق
  if (t === "female") return { label: "Female ♀️", cls: "text-red-600" };           // أحمر فاقع
  if (t === "couple") return { label: "Couple 👨‍❤️‍👨", cls: "text-red-500" };      // أحمر فاتح
  if (t === "lgbt")
    return {
      label: "LGBT 🏳️‍🌈",
      cls: "bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent",
    };
  return null;
}

function coalesce<T = any>(...vals: T[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  return undefined;
}

function readInitialMeta(): Meta {
  // حاول التقاط آخر ميتا محفوظ (إن وُجدت)
  try {
    const w: any = globalThis as any;
    if (w.__ditonaLastPeerMeta && typeof w.__ditonaLastPeerMeta === "object") return w.__ditonaLastPeerMeta;
    const raw = sessionStorage.getItem("ditona:last_peer_meta");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export default function PeerOverlay() {
  const [meta, setMeta] = useState<Meta>(readInitialMeta());
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
        country: coalesce(d.country, d.ctry, d.countryName, d.countryCode, d.cn, d.cc, ""),
        city: coalesce(d.city, d.town, d.locality, d.ci, ""),
        gender: coalesce(d.gender, d.sex, d.g, d.s, d.genderEmoji, d.gender_symbol, d.genderSymbol, d.genderCode, ""),
        avatarUrl: coalesce(d.avatarUrl, d.avatar, d.photo, ""),
        likes: typeof d.likes === "number" ? d.likes : likes,
        displayName: coalesce(d.displayName, d.name, d.nick, d.username, ""),
        vip: !!(d.vip ?? d.isVip ?? d.pro ?? d.premium),
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

    // دعم كلا الاسمين للحدث لضمان التوافق
    window.addEventListener("ditona:peer-meta", onMeta as any);
    window.addEventListener("rtc:peer-meta", onMeta as any);
    window.addEventListener("ditona:like:recv", onLike as any);

    // إن لم تصل ميتا خلال وقت قصير أعد طلبها عبر قناة البيانات
    const t = setTimeout(() => {
      try {
        const room: any = (globalThis as any).__lkRoom;
        if (room?.state === "connected") {
          const payload = new TextEncoder().encode(JSON.stringify({ t: "meta:init" }));
          room.localParticipant?.publishData?.(payload, { reliable: true, topic: "meta" });
        }
      } catch {}
    }, 1200);

    return () => {
      clearTimeout(t);
      window.removeEventListener("ditona:peer-meta", onMeta as any);
      window.removeEventListener("rtc:peer-meta", onMeta as any);
      window.removeEventListener("ditona:like:recv", onLike as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = genderBadge(meta.gender);

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
          {meta.vip && (
            <span className="text-[10px] px-1 rounded-full bg-yellow-400/90 text-black font-bold">VIP</span>
          )}
          <span className="ml-1 text-sm">♥</span>
          <span className="text-xs">{likes}</span>
        </div>
      </div>

      {/* Bottom-left: Country–City + gender label */}
      <div className="absolute bottom-2 left-2 z-30 text-xs sm:text-sm font-medium select-none pointer-events-none drop-shadow">
        <span className="text-white/95">
          {meta.country || meta.city ? `${meta.country ?? ""}${meta.city ? "–" + meta.city : ""}` : ""}
        </span>
        {g && <span className={"ml-2 " + g.cls}>{g.label}</span>}
      </div>
    </>
  );
}
