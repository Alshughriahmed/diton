"use client";
import { emit } from "@/utils/events";
import { useFilters } from "@/state/filters";
import { useRouter } from "next/navigation";

export default function ChatToolbar(){
  const { isVip } = useFilters();
  const router = useRouter();
  
  return (
    <section className="pointer-events-auto fixed inset-x-4 bottom-6 z-40">
      <div className="flex items-center gap-3">
        {/* Prev - يسار */}
        <button 
          className={`px-4 py-2 rounded-lg text-white text-sm border transition-colors font-medium ${
            !isVip 
              ? 'bg-neutral-800/60 border-neutral-700 opacity-60' 
              : 'bg-neutral-600 border-neutral-500 hover:bg-neutral-500'
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
          {!isVip && <span className="ml-1 text-xs">🔒</span>}
        </button>
        
        {/* الأزرار الوسطى */}
        <div className="flex items-center gap-2">
          {/* MutePeer 🔈 */}
          <button 
            onClick={() => emit("ui:toggleRemoteAudio")}
            className="w-12 h-12 rounded-lg bg-neutral-800/80 backdrop-blur text-white border border-neutral-700 hover:bg-neutral-700 transition-colors flex items-center justify-center" 
            aria-label="Mute remote"
          >
            🔈
          </button>

          {/* Mic 🎙️ */}
          <button 
            onClick={() => emit("ui:toggleMic")}
            className="w-12 h-12 rounded-lg bg-neutral-800/80 backdrop-blur text-white border border-neutral-700 hover:bg-neutral-700 transition-colors flex items-center justify-center" 
            aria-label="Mic"
          >
            🎙️
          </button>

          {/* Like ❤ */}
          <button 
            onClick={() => emit("ui:like", { isLiked: true })}
            className="w-12 h-12 rounded-lg bg-pink-600/80 backdrop-blur text-white border border-pink-700 hover:bg-pink-700 transition-colors flex items-center justify-center" 
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
            className={`w-12 h-12 rounded-lg backdrop-blur text-white border transition-colors flex items-center justify-center relative ${
              !isVip 
                ? 'bg-neutral-800/40 border-neutral-700 opacity-60' 
                : 'bg-neutral-800/80 border-neutral-700 hover:bg-neutral-700'
            }`}
            aria-label="Masks"
          >
            🤡
            {!isVip && <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>}
          </button>

          {/* Settings ⚙️ */}
          <button 
            onClick={() => router.push('/settings')}
            className="w-12 h-12 rounded-lg bg-neutral-800/80 backdrop-blur text-white border border-neutral-700 hover:bg-neutral-700 transition-colors flex items-center justify-center" 
            aria-label="Settings"
          >
            ⚙️
          </button>

          {/* Pause ⏯️ */}
          <button 
            onClick={() => emit("ui:togglePlay")}
            className="w-12 h-12 rounded-lg bg-neutral-800/80 backdrop-blur text-white border border-neutral-700 hover:bg-neutral-700 transition-colors flex items-center justify-center" 
            aria-label="Pause/Play"
          >
            ⏯️
          </button>

          {/* Report 🚩 */}
          <button 
            onClick={() => emit("ui:report")}
            className="w-12 h-12 rounded-lg bg-red-600/80 backdrop-blur text-white border border-red-700 hover:bg-red-700 transition-colors flex items-center justify-center" 
            aria-label="Report"
          >
            🚩
          </button>

          {/* Messages 💬 */}
          <button 
            onClick={() => emit("ui:openMessages" as any)}
            className="w-12 h-12 rounded-lg bg-purple-600/80 backdrop-blur text-white border border-purple-700 hover:bg-purple-700 transition-colors flex items-center justify-center" 
            aria-label="Messages"
          >
            💬
          </button>
        </div>
        
        {/* Next - يمين (أكبر قليلاً) */}
        <button 
          className="px-6 py-3 rounded-lg bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-700 transition-colors font-medium" 
          aria-label="Next" 
          onClick={(e)=>{e.preventDefault(); emit("ui:next");}}
        >
          Next
        </button>
      </div>
    </section>
  );
}