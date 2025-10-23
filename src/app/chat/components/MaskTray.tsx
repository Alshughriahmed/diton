// src/components/chat/MaskTray.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";

const MASKS = ["none","bunny","cat","sunglasses","hearts","half","venetian"]; // حسب الموجود في /public/masks

export default function MaskTray() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const offs = [
      on("ui:masks:open",    () => setOpen(true)),
      on("ui:masks:close",   () => setOpen(false)),
      on("ui:masks:toggle",  () => setOpen(v => !v)),
      // توافق قديم
      on("ui:toggleMasks",   () => setOpen(v => !v)),
      // عند فتح درج آخر أغلق هذا
      on("ui:beauty:open",   () => setOpen(false)),
    ];
    return () => offs.forEach(off => { try { off(); } catch {} });
  }, []);

  // منع تمرير الصفحة عند السحب على الدرج
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { if (open) e.stopPropagation(); };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  if (!open) return null;

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
      <div className="mx-auto mb-2 grid place-items-center">
        <button
          onClick={() => setOpen(false)}
          className="pointer-events-auto px-4 py-2 rounded-xl bg-white/15 text-white text-sm backdrop-blur border border-white/20"
        >
          Close
        </button>
      </div>

      <div className="pointer-events-auto mx-2 sm:mx-6 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 shadow-lg overflow-x-auto">
        <div className="flex items-stretch gap-2 px-3 py-3 max-h-[28vh] sm:max-h-[24vh]">
          {MASKS.map((m) => {
            const isNone = m === "none";
            return (
              <button
                key={m}
                onClick={() => emit("ui:setMask", { name: isNone ? null : m })}
                className="min-w-[96px] sm:min-w-[116px] aspect-[4/3] rounded-xl bg-white/5 border border-white/15 overflow-hidden grid place-items-center hover:bg-white/10"
                aria-label={isNone ? "No mask" : `Mask ${m}`}
              >
                {isNone ? (
                  <span className="text-white/70 text-sm">None</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/masks/${m}.png`} alt="" className="h-full w-full object-contain" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
