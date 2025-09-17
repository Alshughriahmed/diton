"use client";
import { useState, useEffect } from "react";
import { emit } from "@/utils/events";
import { useVip } from "@/hooks/useVip";

export default function ChatToolbar(){
  const [msgOpen,setMsgOpen]=useState(false);
  const [micOn,setMicOn]=useState(true);
  const [paused,setPaused]=useState(false);
  const { isVip } = useVip();
  const freeForAll = process.env.NEXT_PUBLIC_FREE_FOR_ALL === "1";

  useEffect(()=>{ // sync with messaging bar
    const onOpen = ()=>setMsgOpen(true);
    const onClose= ()=>setMsgOpen(false);
    window.addEventListener("ui:openMessaging", onOpen as any);
    window.addEventListener("ui:closeMessaging", onClose as any);
    return ()=>{ window.removeEventListener("ui:openMessaging",onOpen as any); window.removeEventListener("ui:closeMessaging",onClose as any); };
  },[]);

  return (
    <>
      {/* Prev / Next icons large, no boxes */}
      <button data-ui="btn-prev" 
        onClick={()=>{ if(isVip || freeForAll) emit("ui:prev"); }}
        disabled={!isVip && !freeForAll}
        title={!isVip && !freeForAll ? "VIP only" : "Previous match"}
        className={`fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] left-2 sm:left-3 z-[50] text-3xl sm:text-4xl select-none ${!isVip ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>⏮️</button>
      <button data-ui="btn-next" onClick={()=>emit("ui:next")} data-ui="btn-next"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] right-2 sm:right-3 z-[50] text-3xl sm:text-4xl select-none">⏭️</button>

      {/* Bottom toolbar fixed forever */}
      <section className="pointer-events-auto fixed inset-x-2 sm:inset-x-4 z-[60]"
               style={{bottom: "calc(env(safe-area-inset-bottom) + 8px)"}}>
        <div className="relative flex flex-row-reverse items-center gap-2 sm:gap-3 justify-center">
          {/* 💬 messages */}
          <button data-ui="btn-messages"
            onClick={()=>{ const ev = msgOpen?"ui:closeMessaging":"ui:openMessaging"; setMsgOpen(!msgOpen); emit(ev); }}
            aria-pressed={msgOpen}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg border text-white ${msgOpen?'bg-purple-600/40 border-purple-400/60':'bg-black/20 border-white/20 hover:bg-white/10'}`}>💬</button>

          {/* ❤ like */}
          <button data-ui="btn-like" onClick={()=>emit("ui:like",{isLiked:true})}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-pink-600/30 text-white border border-pink-400/40 hover:bg-pink-500/40">❤</button>

          {/* 🔊 remote audio */}
          <button data-ui="btn-remote-audio" onClick={()=>emit("ui:toggleRemoteAudio")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10">🔊</button>

          {/* 🎤 mic */}
          <button data-ui="btn-mic"
            onClick={()=>{ setMicOn(v=>!v); emit("ui:toggleMic"); }}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border ${micOn?'bg-green-600/30 border-green-400/40':'bg-red-600/30 border-red-400/40'}`}>{micOn?'🎤':'🔇'}</button>

          {/* ⏸️ pause */}
          <button data-ui="btn-pause"
            onClick={()=>{ setPaused(v=>!v); emit("ui:togglePlay"); }}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border ${paused?'bg-orange-600/30 border-orange-400/40':'bg-green-600/30 border-green-400/40'}`}>{paused?'▶️':'⏸️'}</button>

          {/* ⚙️ settings */}
          <button data-ui="btn-settings" onClick={()=>{ try{window.location.href='/settings'}catch{} }}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10">⚙️</button>

          {/* 🎭 masks */}
          <button data-ui="btn-masks" onClick={()=>emit("ui:toggleMasks")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10">🎭</button>

          {/* 🚩 report */}
          <button data-ui="btn-report" onClick={()=>emit("ui:report")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-red-600/30 text-white border border-red-400/40 hover:bg-red-500/40">🚩</button>
        </div>
      </section>
    </>
  );
}