"use client";
import { useEffect, useState } from "react";
export default function UserTopRightControls(){
  const [isVip,setIsVip]=useState(false);
  useEffect(()=>{(async()=>{
    try { const r=await fetch("/api/user/vip-status",{cache:"no-store"}); const j=await r.json(); setIsVip(!!j?.isVip); } catch { setIsVip(false); }
  })();},[]);
  return (
    <div className="absolute right-3 top-[52%] z-[40] flex items-center gap-2">
      <button className="px-2 py-1 rounded-md bg-neutral-800 text-white text-sm border border-neutral-700" aria-label="Switch camera">Switch Cam</button>
      <button className="px-2 py-1 rounded-md bg-neutral-800 text-white text-sm border border-neutral-700" aria-label="Beauty filter">Beauty</button>
      <span className={`text-[11px] px-2 py-[2px] rounded border ${isVip? "bg-yellow-500/20 border-yellow-500/40":"bg-neutral-800 border-neutral-700"}`}>{isVip? "VIP":"Guest"}</span>
    </div>
  );
}