// src/app/chat/components/MaskTray.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { emit } from "@/utils/events";

type Props = { open: boolean; onClose: () => void };

const MASKS = [
  { id: "none", label: "None", icon: "/masks/none.png" },
  { id: "bunny", label: "Bunny", icon: "/masks/bunny.png" },
  { id: "venetian", label: "Venetian", icon: "/masks/venetian.png" },
  { id: "hearts", label: "Hearts", icon: "/masks/hearts.png" },
  { id: "half", label: "Half", icon: "/masks/half.png" },
  { id: "sunglasses", label: "Sunglasses", icon: "/masks/sunglasses.png" },
  { id: "cat", label: "Cat", icon: "/masks/cat.png" },
];

export default function MaskTray({ open, onClose }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    for (const m of MASKS) {
      if (m.id === "none") continue;
      const img = new Image();
      img.src = m.icon;
    }
  }, [open]);

  const cls = useMemo(
    () =>
      `fixed left-0 right-0 bottom-0 z-40 transition-transform duration-200 ease-out ${
        open ? "translate-y-0" : "translate-y-full"
      }`,
    [open],
  );

  const pick = (id: string) => {
    if (id === "none") emit("ui:setMask", { name: null });
    else emit("ui:setMask", { name: id });
    onClose();
  };

  return (
    <div className={cls} aria-hidden={!open}>
      <div className="mx-auto max-w-4xl rounded-t-2xl bg-black/70 backdrop-blur text-white shadow-lg">
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={onClose} className="text-sm opacity-80 hover:opacity-100">
            Close
          </button>
          <div className="text-sm opacity-70">Masks</div>
          <div className="flex gap-2">
            <button
              onClick={() => scrollerRef.current?.scrollBy({ left: -240, behavior: "smooth" })}
              className="text-lg px-2 opacity-80 hover:opacity-100"
              aria-label="Scroll left"
            >
              ‹
            </button>
            <button
              onClick={() => scrollerRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
              className="text-lg px-2 opacity-80 hover:opacity-100"
              aria-label="Scroll right"
            >
              ›
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto px-3 pb-4 snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {MASKS.map((m) => (
            <button
              key={m.id}
              onClick={() => pick(m.id)}
              className="snap-start shrink-0 w-24 h-24 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition flex flex-col items-center justify-center border border-white/10"
            >
              <img src={m.icon} alt={m.id} className="w-14 h-14 object-contain pointer-events-none select-none" draggable={false} />
              <div className="text-[11px] mt-1 opacity-80">{m.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
