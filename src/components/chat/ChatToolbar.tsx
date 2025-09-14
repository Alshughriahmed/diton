"use client";
import { emit } from "@/utils/events";
import { useFilters } from "@/state/filters";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ChatToolbar(){
  const { isVip } = useFilters();
  const router = useRouter();
  const freeForAll = process.env.NEXT_PUBLIC_FREE_FOR_ALL === "1";

  const [isMicOn, setIsMicOn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  const toggleMic = () => { setIsMicOn(v=>!v); emit("ui:toggleMic"); };
  const togglePlay = () => { setIsPaused(v=>!v); emit("ui:togglePlay"); };

  const toggleMessages = () => {
    setMsgOpen(v=>!v);
    emit(!msgOpen ? "ui:openMessaging" : "ui:closeMessaging");
  };

  return (
    <>
      {/* Prev ⏮️ كبير - يسار أعلى الشريط */}
      <button
        data-ui="btn-prev"
        onClick={(e)=>{e.preventDefault(); if(isVip || freeForAll){ emit("ui:prev"); }}}
        disabled={!isVip && !freeForAll}
        title={!isVip && !freeForAll ? "VIP only" : "Previous"}
        className={`fixed bottom-[92px] left-3 z-50 w-24 h-12 sm:w-28 sm:h-14 rounded-xl border backdrop-blur font-medium transition-all duration-200 ${
          !isVip && !freeForAll 
            ? 'bg-black/20 text-gray-500 border-gray-600/40 cursor-not-allowed opacity-50' 
            : 'bg-black/40 text-white border-white/20 hover:bg-black/50'
        }`}
        aria-label={!isVip && !freeForAll ? "Previous (VIP only)" : "Previous"}
      >⏮️</button>

      {/* Next ⏭️ كبير - يمين أعلى الشريط */}
      <button
        data-ui="btn-next"
        onClick={(e)=>{e.preventDefault(); emit("ui:next");}}
        className="fixed bottom-[92px] right-3 z-50 w-24 h-12 sm:w-28 sm:h-14 rounded-xl bg-emerald-600/80 text-white border border-emerald-400/60 hover:bg-emerald-700/80 backdrop-blur font-medium"
        aria-label="Next"
      >⏭️</button>

      {/* شريط الأدوات السفلي */}
      <section data-toolbar className="pointer-events-auto fixed inset-x-2 sm:inset-x-4 bottom-4 sm:bottom-6 z-40">
        <div className="flex items-center gap-2 sm:gap-3 justify-center flex-wrap">
          {/* يمين ← يسار */}

          {/* Messages 💬 */}
          <button
            data-ui="btn-messages"
            onClick={toggleMessages}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg border transition-all duration-200 flex items-center justify-center text-sm sm:text-base ${msgOpen?'bg-purple-600/40 border-purple-400/60 text-white':'bg-black/20 border-white/20 hover:bg-white/10 text-white'} `}
            aria-pressed={msgOpen}
            aria-label="Messages"
          >💬</button>

          {/* Like ❤ */}
          <button
            data-ui="btn-like"
            onClick={()=>emit("ui:like",{isLiked:true})}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-pink-600/30 text-white border border-pink-400/40 hover:bg-pink-500/40 transition-all duration-200 flex items-center justify-center text-sm sm:text-base"
            aria-label="Like"
          >❤</button>

          {/* Mute remote 🔊 */}
          <button
            data-ui="btn-remote-audio"
            onClick={()=>emit("ui:toggleRemoteAudio")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10 transition-all duration-200 flex items-center justify-center text-sm sm:text-base"
            aria-label="Mute remote"
          >🔊</button>

          {/* Mic 🎤 */}
          <button
            data-ui="btn-mic"
            onClick={toggleMic}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border transition-all duration-200 flex items-center justify-center text-sm sm:text-base ${isMicOn?'bg-green-600/30 border-green-400/40 hover:bg-green-500/40':'bg-red-600/30 border-red-400/40 hover:bg-red-500/40'}`}
            aria-label={isMicOn?"Mute mic":"Unmute mic"}
            aria-pressed={!isMicOn}
          >{isMicOn?'🎤':'🔇'}</button>

          {/* Pause ⏸️ */}
          <button
            data-ui="btn-pause"
            onClick={togglePlay}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-white border transition-all duration-200 flex items-center justify-center text-sm sm:text-base ${isPaused?'bg-orange-600/30 border-orange-400/40 hover:bg-orange-500/40':'bg-green-600/30 border-green-400/40 hover:bg-green-500/40'}`}
            aria-label={isPaused?'Resume':'Pause'}
            aria-pressed={isPaused}
          >{isPaused?'▶️':'⏸️'}</button>

          {/* Settings ⚙️ */}
          <button
            data-ui="btn-settings"
            onClick={()=>{ try{window.location.href='/settings'}catch{} }}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10 transition-all duration-200 flex items-center justify-center text-sm sm:text-base"
            aria-label="Settings"
          >⚙️</button>

          {/* Masks 🎭 */}
          <button
            data-ui="btn-masks"
            onClick={()=>{ if(!isVip && !freeForAll){ emit("ui:upsell","masks"); return; } emit("ui:toggleMasks"); }}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 text-white border border-white/20 hover:bg-white/10 transition-all duration-200 flex items-center justify-center text-sm sm:text-base"
            aria-label="Masks"
          >🎭</button>

          {/* Report 🚩 */}
          <button
            data-ui="btn-report"
            onClick={()=>emit("ui:report")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-red-600/30 text-white border border-red-400/40 hover:bg-red-500/40 transition-all duration-200 flex items-center justify-center text-sm sm:text-base"
            aria-label="Report"
          >🚩</button>
        </div>
      </section>
    </>
  );
}
