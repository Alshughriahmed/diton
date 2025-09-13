"use client";
import { useState } from "react";
import { emit } from "@/utils/events";
import { useFilters } from "@/state/filters";

export default function ChatToolbar(){
  const { isVip } = useFilters();
  const freeAll = true; // كل الميزات مفتوحة الآن
  const [micOn, setMicOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  const toggleMsg = () => {
    setMsgOpen(v=>!v);
    emit(!msgOpen ? "ui:openMessaging" : "ui:closeMessaging");
  };

  return (
    <>
      {/* Prev / Next */}
      <button
        data-ui="btn-prev"
        onClick={()=>{ if(!isVip && !freeAll){ emit("ui:upsell","prev"); return; } emit("ui:prev"); }}
        className="fixed bottom-[92px] left-3 z-50 w-24 h-12 sm:w-28 sm:h-14 rounded-xl bg-black/40 text-white border border-white/20 hover:bg-black/50 backdrop-blur font-medium"
        aria-label="Previous">⏮️</button>

      <button
        data-ui="btn-next"
        onClick={()=>emit("ui:next")}
        className="fixed bottom-[92px] right-3 z-50 w-24 h-12 sm:w-28 sm:h-14 rounded-xl bg-emerald-600/80 text-white border border-emerald-400/60 hover:bg-emerald-700/80 backdrop-blur font-medium"
        aria-label="Next">⏭️</button>

      {/* Bottom toolbar R→L */}
      <section data-toolbar className="pointer-events-auto fixed inset-x-2 sm:inset-x-4 bottom-4 sm:bottom-6 z-40">
        <div className="flex items-center gap-2 sm:gap-3 justify-center flex-wrap">

          <button data-ui="btn-messages" onClick={toggleMsg}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg border flex items-center justify-center ${msgOpen?'bg-purple-600/40 border-purple-400/60':'bg-black/20 border-white/20 hover:bg-white/10'} text-white`} aria-pressed={msgOpen} aria-label="Messages">💬</button>

          <button data-ui="btn-like" onClick={()=>emit("ui:like",{isLiked:true})}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-pink-600/30 text-white border border-pink-400/40 hover:bg-pink-500/40" aria-label="Like">❤</button>

          <button data-ui="btn-remote-audio" onClick={()=>emit("ui:toggleRemoteAudio")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10" aria-label="Mute remote">🔊</button>

          <button data-ui="btn-mic" onClick={()=>{setMicOn(v=>!v); emit("ui:toggleMic");}}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border ${micOn?'bg-green-600/30 border-green-400/40 hover:bg-green-500/40':'bg-red-600/30 border-red-400/40 hover:bg-red-500/40'}`}
            aria-label={micOn?'Mute mic':'Unmute mic'}>{micOn?'🎤':'🔇'}</button>

          <button data-ui="btn-pause" onClick={()=>{setPaused(v=>!v); emit("ui:togglePlay");}}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border ${paused?'bg-orange-600/30 border-orange-400/40 hover:bg-orange-500/40':'bg-green-600/30 border-green-400/40 hover:bg-green-500/40'}`}
            aria-label={paused?'Resume':'Pause'}>{paused?'▶️':'⏸️'}</button>

          <button data-ui="btn-settings" onClick={()=>{ try{window.location.href='/settings'}catch{} }}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10" aria-label="Settings">⚙️</button>

          <button data-ui="btn-masks" onClick={()=>emit("ui:toggleMasks")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10" aria-label="Masks">🎭</button>

          <button data-ui="btn-report" onClick={()=>emit("ui:report")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-red-600/30 text-white border border-red-400/40 hover:bg-red-500/40" aria-label="Report">🚩</button>

        </div>
      </section>
    </>
  );
}