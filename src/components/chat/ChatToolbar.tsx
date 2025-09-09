"use client";
import { emit } from "@/utils/events";
import { useNextPrev } from "@/hooks/useNextPrev";
import { useFilters } from "@/state/filters";
import CountryFilter from "./CountryFilter";
import GenderFilter from "./GenderFilter";
import BeautyControls from "./BeautyControls";
import MaskStrip from "./MaskStrip";
import FriendsView from "./FriendsView";

export default function ChatToolbar(){
  const { isVip } = useFilters();
  const { next, prev } = useNextPrev();
  
  return (
    <div className="absolute left-0 right-0 bottom-0 z-[35] px-4 pb-3 pt-2">
      <div className="mx-auto max-w-6xl rounded-2xl bg-black/50 backdrop-blur border border-white/10">
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          {/* Left: Filters */}
          <div className="flex items-center gap-2">
            <CountryFilter />
            <GenderFilter />
          </div>
          
          {/* Center: Effects */}
          <div className="flex items-center gap-2">
            <BeautyControls />
            <MaskStrip />
          </div>

          {/* Right: Main Toolbar (Right to Left as requested) */}
          <div className="flex items-center gap-2">
            {/* Next (أكبر زر) */}
            <button 
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm border border-emerald-500 hover:bg-emerald-700 transition-colors font-medium" 
              aria-label="Next" 
              onClick={(e)=>{e.preventDefault(); emit("ui:next");}}
            >
              Next ⏭️
            </button>

            {/* كتم صوت الطرف الثاني */}
            <button 
              onClick={() => emit("ui:toggleRemoteAudio" as any)}
              className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700 hover:bg-neutral-700 transition-colors" 
              aria-label="Mute remote"
            >
              🔈
            </button>

            {/* مايك */}
            <button 
              onClick={() => emit("ui:toggleMic")}
              className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700 hover:bg-neutral-700 transition-colors" 
              aria-label="Mic"
            >
              🎙️
            </button>

            {/* Like */}
            <button 
              onClick={() => emit("ui:like", { isLiked: true })}
              className="px-3 py-2 rounded-lg bg-pink-600 text-white text-sm border border-pink-700 hover:bg-pink-700 transition-colors" 
              aria-label="Like"
            >
              ❤
            </button>

            {/* Masks (VIP gate) */}
            <button 
              onClick={() => {
                if (!isVip) {
                  emit("ui:upsell", "masks");
                  return;
                }
                emit("ui:toggleMasks" as any);
              }}
              className={`px-3 py-2 rounded-lg text-white text-sm border transition-colors ${
                !isVip 
                  ? 'bg-neutral-800/60 border-neutral-700 opacity-60' 
                  : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'
              }`}
              aria-label="Masks"
            >
              🤡
              {!isVip && <span className="ml-1 text-xs">🔒</span>}
            </button>

            {/* Settings */}
            <button 
              onClick={() => {
                try {
                  window.location.href = '/settings';
                } catch(e){
                  emit("ui:openSettings");
                }
              }}
              className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700 hover:bg-neutral-700 transition-colors" 
              aria-label="Settings"
            >
              ⚙️
            </button>

            {/* إيقاف/تشغيل */}
            <button 
              onClick={() => emit("ui:togglePlay" as any)}
              className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700 hover:bg-neutral-700 transition-colors" 
              aria-label="Stop/Play"
            >
              ⏯️
            </button>

            {/* Report */}
            <button 
              onClick={() => emit("ui:report")}
              className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm border border-red-700 hover:bg-red-700 transition-colors" 
              aria-label="Report"
            >
              🚩
            </button>

            {/* Prev (VIP gate) */}
            <button 
              className={`px-3 py-2 rounded-lg text-white text-sm border transition-colors ${
                !isVip 
                  ? 'bg-neutral-800/60 border-neutral-700 opacity-60' 
                  : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'
              }`}
              aria-label="Prev" 
              onClick={(e)=>{
                e.preventDefault(); 
                if (!isVip) {
                  emit("ui:upsell", "prev");
                  return;
                }
                emit("ui:prev");
              }}
            >
              ⏮️ Prev
              {!isVip && <span className="ml-1 text-xs">🔒</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}