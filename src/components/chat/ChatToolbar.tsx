"use client";
import { emit } from "@/utils/events";
import { useNextPrev } from "@/hooks/useNextPrev";

export default function ChatToolbar(){
  const { next, prev } = useNextPrev();
  return (
    <div className="absolute left-0 right-0 bottom-0 z-[35] px-4 pb-3 pt-2">
      <div className="mx-auto max-w-5xl rounded-2xl bg-black/50 backdrop-blur border border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700" aria-label="Toggle Video">Video</button>
            <button className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700" aria-label="Toggle Mic">Mic</button>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700" aria-label="Report">Report</button>
            <button className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700" aria-label="Settings">Settings</button>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-lg bg-neutral-800 text-white text-sm border border-neutral-700" aria-label="Prev" onClick={(e)=>{e.preventDefault(); emit("ui:prev");}}>Prev</button>
            <button className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm border border-emerald-500" aria-label="Next" onClick={(e)=>{e.preventDefault(); emit("ui:next");}}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
