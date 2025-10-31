"use client";
import { useEffect, useState } from "react";

type NormGender = "m" | "f" | "c" | "l" | "u";
type PeerMeta = {
  pairId?: string;
  displayName?: string;
  vip?: boolean;
  likes?: number;
  hideLikes?: boolean;
  country?: string;
  hideCountry?: boolean;
  city?: string;
  hideCity?: boolean;
  gender?: NormGender | string;
  avatarUrl?: string;
  avatar?: string;
};

function curPair(): string | null {
  try { const w:any = globalThis as any; return w.__ditonaPairId || w.__pairId || null; } catch { return null; }
}
function readCached(): PeerMeta {
  try { const raw = sessionStorage.getItem("ditona:last_peer_meta"); return raw ? JSON.parse(raw) as PeerMeta : {}; } catch { return {}; }
}
function normGender(g: unknown): NormGender {
  const s = String(g ?? "").toLowerCase().trim();
  if (s === "m" || s === "male") return "m";
  if (s === "f" || s === "female") return "f";
  if (s === "c" || s === "couple") return "c";
  if (s === "l" || s === "lgbt" || s === "lgbti" || s === "lgbtq") return "l";
  return "u";
}
function genderSymbol(g: NormGender) { return g==="m"?"♂":g==="f"?"♀":g==="c"?"⚤":g==="l"?"🏳️‍🌈":""; }
function genderColor(g: NormGender) { return g==="m"?"text-blue-500":g==="f"?"text-red-500":g==="c"?"text-rose-700":""; }

export default function PeerOverlay() {
  const [meta, setMeta] = useState<PeerMeta>(() => readCached());

  function apply(d: PeerMeta) {
    const pidEvt = d?.pairId, pidNow = curPair();
    if (pidEvt && pidNow && pidEvt !== pidNow) return;
    setMeta(d);
    try { sessionStorage.setItem("ditona:last_peer_meta", JSON.stringify(d)); } catch {}
  }

  useEffect(() => {
    const onMeta = (e:any) => {
      const src = e?.detail || {};
      // دعم الصيغتين: {pairId, meta:{...}} و { ...مفلطح }
      const flat: PeerMeta = src && typeof src.meta === "object"
        ? { ...(src.meta || {}), pairId: src.pairId ?? src.meta.pairId }
        : src;
      apply(flat);
    };
    const onLikeSync = (e:any) => {
      const d = e?.detail || {};
      const pidEvt = d?.pairId || curPair(), pidNow = curPair();
      if (pidEvt && pidNow && pidEvt !== pidNow) return;
      if (typeof d.count === "number") setMeta(m => ({ ...m, likes: d.count }));
    };
    const reapply = () => { const c = readCached(); if (c && Object.keys(c).length) setMeta(c); };
    const onPhase = (e:any) => {
      const ph = e?.detail?.phase;
      if (ph === "boot" || ph === "idle" || ph === "searching" || ph === "stopped") {
        setMeta(m => ({ ...m, displayName:"", country:"", city:"", gender: normGender("u") }));
      }
    };

    window.addEventListener("ditona:peer-meta", onMeta as any, { passive:true } as any);
    window.addEventListener("like:sync", onLikeSync as any, { passive:true } as any);
    window.addEventListener("rtc:pair", reapply as any, { passive:true } as any);
    window.addEventListener("lk:attached", reapply as any, { passive:true } as any);
    window.addEventListener("rtc:phase", onPhase as any, { passive:true } as any);

    reapply();
    return () => {
      window.removeEventListener("ditona:peer-meta", onMeta as any);
      window.removeEventListener("like:sync", onLikeSync as any);
      window.removeEventListener("rtc:pair", reapply as any);
      window.removeEventListener("lk:attached", reapply as any);
      window.removeEventListener("rtc:phase", onPhase as any);
    };
  }, []);

  const g = normGender(meta?.gender);
  const likesText = meta?.hideLikes ? "" : typeof meta?.likes === "number" ? `❤️ ${meta.likes}` : "";
  const avatarUrl = meta?.avatarUrl || meta?.avatar || "";

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]" data-ui="peer-overlay-root">
      {/* أعلى يسار */}
      <div className="absolute left-3 top-3 z-[80] flex items-center gap-2 pointer-events-auto">
        <img data-ui="peer-avatar" alt="" className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-cover ring-1 ring-white/20 select-none"
             src={avatarUrl || undefined} draggable={false}/>
        <span data-ui="peer-name" className="text-white/90 text-sm sm:text-base font-semibold">{meta?.displayName || ""}</span>
        <span data-ui="peer-vip" className="text-yellow-400 text-base sm:text-lg font-semibold">
          {typeof meta?.vip === "boolean" ? (meta.vip ? "👑" : "🚫👑") : ""}
        </span>
        <span data-ui="peer-likes" className="text-pink-400 text-sm sm:text-base font-semibold">{likesText}</span>
      </div>

      {/* أسفل يسار */}
      <div className="absolute left-3 bottom-3 z-[70] flex items-center gap-2 rounded-xl bg-black/35 backdrop-blur-sm px-2 py-1 pointer-events-auto">
        <span data-ui="peer-country" className="text-white/80 text-sm sm:text-base">{meta?.hideCountry ? "" : meta?.country || ""}</span>
        <span className="text-white/60">–</span>
        <span data-ui="peer-city" className="text-white/60 text-sm sm:text-base">{meta?.hideCity ? "" : meta?.city || ""}</span>
        <span data-ui="peer-gender" className={`font-semibold leading-none text-[1.5rem] sm:text-[1.75rem] ${genderColor(g)}`} aria-label="peer-gender">
          {genderSymbol(g)}
        </span>
      </div>
    </div>
  );
}
