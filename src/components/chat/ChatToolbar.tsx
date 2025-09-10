"use client";
import { emit } from "@/utils/events";
import { useFilters } from "@/state/filters";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function ChatToolbar(){
  const { isVip } = useFilters();
  const router = useRouter();
  
  // Button states for ON/OFF visual feedback
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  
  // Simple toggle handlers for visual feedback only
  const handleMicToggle = () => {
    setIsMicOn(!isMicOn);
    emit("ui:toggleMic");
  };
  
  const handleCamToggle = () => {
    setIsCamOn(!isCamOn);
    emit("ui:toggleCam");
  };
  
  const handlePlayToggle = () => {
    setIsPaused(!isPaused);
    emit("ui:togglePlay");
  };
  
  return (
    <section data-toolbar className="pointer-events-auto fixed inset-x-2 sm:inset-x-4 bottom-4 sm:bottom-6 z-40">
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
        {/* Prev - يسار */}
        <button 
          className={`px-3 sm:px-4 py-2 rounded-lg text-white text-xs sm:text-sm border transition-all duration-200 font-medium ${
            !isVip 
              ? 'bg-black/20 border-white/20 opacity-60' 
              : 'bg-black/30 border-white/30 hover:bg-white/10'
          }`}
          aria-label="Previous" 
          onClick={(e)=>{
            e.preventDefault(); 
            if (!isVip) {
              emit("ui:upsell", { feature: "prev" });
              return;
            }
            emit("ui:prev");
          }}
        >
          Prev
          {!isVip && process.env.NEXT_PUBLIC_FREE_FOR_ALL !== "1" && <span className="ml-1 text-xs">🔒</span>}
        </button>
        
        {/* الأزرار الوسطى */}
        <div className="flex items-center gap-2">
          {/* MutePeer 🔈 */}
          <button 
            onClick={() => emit("ui:toggleRemoteAudio")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 backdrop-blur-sm text-white border border-white/20 hover:bg-white/10 transition-all duration-200 flex items-center justify-center text-sm sm:text-base" 
            aria-label="Mute remote"
          >
            🔈
          </button>

          {/* Mic 🎙️ */}
          <button 
            onClick={handleMicToggle}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg backdrop-blur-sm text-white border transition-all duration-200 flex items-center justify-center text-sm sm:text-base ${
              isMicOn 
                ? 'bg-green-600/30 border-green-400/40 hover:bg-green-500/40' 
                : 'bg-red-600/30 border-red-400/40 hover:bg-red-500/40'
            }`}
            aria-label={isMicOn ? "Mute mic" : "Unmute mic"}
          >
            {isMicOn ? '🎙️' : '🔇'}
          </button>

          {/* Camera 📹 */}
          <button 
            onClick={handleCamToggle}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg backdrop-blur-sm text-white border transition-all duration-200 flex items-center justify-center text-sm sm:text-base ${
              isCamOn 
                ? 'bg-green-600/30 border-green-400/40 hover:bg-green-500/40' 
                : 'bg-red-600/30 border-red-400/40 hover:bg-red-500/40'
            }`}
            aria-label={isCamOn ? "Turn off camera" : "Turn on camera"}
          >
            {isCamOn ? '📹' : '📷'}
          </button>

          {/* Like ❤ */}
          <button 
            onClick={() => emit("ui:like", { isLiked: true })}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-pink-600/30 backdrop-blur-sm text-white border border-pink-400/40 hover:bg-pink-500/40 transition-all duration-200 flex items-center justify-center text-sm sm:text-base" 
            aria-label="Like"
          >
            ❤
          </button>

          {/* Masks 🤡 (VIP gate) */}
          <button 
            onClick={() => {
              if (!isVip) {
                emit("ui:upsell", { feature: "masks" });
                return;
              }
              emit("ui:toggleMasks");
            }}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg backdrop-blur-sm text-white border transition-all duration-200 flex items-center justify-center relative text-sm sm:text-base ${
              !isVip 
                ? 'bg-black/10 border-white/10 opacity-60' 
                : 'bg-black/20 border-white/20 hover:bg-white/10'
            }`}
            aria-label="Masks"
          >
            🤡
            {!isVip && process.env.NEXT_PUBLIC_FREE_FOR_ALL !== "1" && <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>}
          </button>

          {/* Settings ⚙️ */}
          <button 
            onClick={() => router.push('/settings')}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-black/20 backdrop-blur-sm text-white border border-white/20 hover:bg-white/10 transition-all duration-200 flex items-center justify-center text-sm sm:text-base" 
            aria-label="Settings"
          >
            ⚙️
          </button>

          {/* Pause ⏯️ */}
          <button 
            onClick={handlePlayToggle}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg backdrop-blur-sm text-white border transition-all duration-200 flex items-center justify-center text-sm sm:text-base ${
              isPaused 
                ? 'bg-orange-600/30 border-orange-400/40 hover:bg-orange-500/40' 
                : 'bg-green-600/30 border-green-400/40 hover:bg-green-500/40'
            }`}
            aria-label={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>

          {/* Report 🚩 */}
          <button 
            onClick={() => emit("ui:report")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-red-600/30 backdrop-blur-sm text-white border border-red-400/40 hover:bg-red-500/40 transition-all duration-200 flex items-center justify-center text-sm sm:text-base" 
            aria-label="Report"
          >
            🚩
          </button>

          {/* Messages 💬 */}
          <button 
            onClick={() => emit("ui:openMessages" as any)}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-purple-600/30 backdrop-blur-sm text-white border border-purple-400/40 hover:bg-purple-500/40 transition-all duration-200 flex items-center justify-center text-sm sm:text-base" 
            aria-label="Messages"
          >
            💬
          </button>
        </div>
        
        {/* Next - يمين (أكبر قليلاً) */}
        <button 
          className="px-4 sm:px-6 py-2 sm:py-3 rounded-lg bg-emerald-600/80 backdrop-blur-sm text-white border border-emerald-400/60 hover:bg-emerald-700/80 transition-all duration-200 font-medium text-sm sm:text-base" 
          aria-label="Next" 
          onClick={(e)=>{e.preventDefault(); emit("ui:next");}}
        >
          Next
        </button>
      </div>
    </section>
  );
}