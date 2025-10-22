"use client";
import { useEffect, useState } from "react";
import { on, emit } from "@/utils/events";

type MaskItem = { name: string; label: string; file: string };

const MASKS: MaskItem[] = [
  { name: "venetian", label: "Venetian", file: "/masks/venetian.svg" },
  { name: "glasses",  label: "Glasses",  file: "/masks/glasses.svg"  },
  { name: "heart-eyes", label: "Hearts", file: "/masks/heart-eyes.svg" },
  { name: "cat",      label: "Cat",      file: "/masks/cat.svg"      },
  { name: "guy",      label: "Guy",      file: "/masks/guy.svg"      },
];

export default function MaskPicker() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const offOpen = on("ui:openMaskPicker" as any, () => setOpen(true));
    const offClose = on("ui:closeMaskPicker" as any, () => setOpen(false));
    return () => { offOpen(); offClose(); };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/30" onClick={() => setOpen(false)}>
      <div className="w-full bg-slate-900/95 backdrop-blur rounded-t-2xl border-t border-slate-700 p-3"
           onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <button className="text-slate-300 px-3 py-1" onClick={()=>setOpen(false)}>✕</button>
          <div className="text-slate-200 text-sm">Choose a mask</div>
          <div className="w-8" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {MASKS.map(m => (
            <button key={m.name}
              onClick={() => { emit("ui:setMask", { name: m.name }); setOpen(false); }}
              className="min-w-[88px] h-[88px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.file} alt={m.label} className="w-14 h-14 object-contain pointer-events-none" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
