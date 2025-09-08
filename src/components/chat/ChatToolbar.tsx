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
          {/* Left: Media Controls */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => emit("ui:toggleCam")}
              className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700 hover:bg-neutral-700 transition-colors" 
              aria-label="Toggle Video"
            >
              📹
            </button>
            <button 
              onClick={() => emit("ui:toggleMic")}
              className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700 hover:bg-neutral-700 transition-colors" 
              aria-label="Toggle Mic"
            >
              🎤
            </button>
            <button 
              onClick={() => emit("ui:switchCamera")}
              className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700 hover:bg-neutral-700 transition-colors" 
              aria-label="Switch Camera"
            >
              🔄
            </button>
          </div>
          
          {/* Center: Filters & Effects */}
          <div className="flex items-center gap-2">
            <CountryFilter />
            <GenderFilter />
            <BeautyControls />
            <MaskStrip />
          </div>

          {/* Center-Right: Actions */}
          <div className="flex items-center gap-2">
            <FriendsView />
            <button 
              onClick={() => emit("ui:report")}
              className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm border border-red-700 hover:bg-red-700 transition-colors" 
              aria-label="Report"
            >
              🚫
            </button>
            <button 
              onClick={() => emit("ui:openSettings")}
              className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700 hover:bg-neutral-700 transition-colors" 
              aria-label="Settings"
            >
              ⚙️
            </button>
          </div>
          
          {/* Right: Navigation */}
          <div className="flex items-center gap-2">
            <button 
              className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700 hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
              aria-label="Prev" 
              disabled={!isVip} 
              onClick={(e)=>{e.preventDefault(); emit("ui:prev");}}
            >
              ⏮️ Prev
            </button>
            <button 
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm border border-emerald-500 hover:bg-emerald-700 transition-colors" 
              aria-label="Next" 
              onClick={(e)=>{e.preventDefault(); emit("ui:next");}}
            >
              Next ⏭️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}