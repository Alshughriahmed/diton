// src/components/chat/MaskTray.tsx
"use client";

import { memo, useEffect } from "react";
import { emit, on } from "@/utils/events";

type MaskTrayProps = {
  open: boolean;
  onClose: () => void;
};

function MaskTray({ open, onClose }: MaskTrayProps) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    const off = on("ui:closeMasks", onClose);
    return () => {
      window.removeEventListener("keydown", onEsc);
      off();
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 transition-transform duration-200 ${
        open ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="pointer-events-auto mx-auto mb-3 w-[min(900px,96%)] rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl">
        {/* زر إغلاق داخل الشريط ويختفي عند الإغلاق */}
        {open && (
          <div className="flex justify-center pt-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white/90 text-black text-sm font-medium shadow"
            >
              Close
            </button>
          </div>
        )}

        {/* قائمة الماسكات */}
        <div className="h-[92px] px-3 pb-3">
          <div className="flex h-full items-center gap-2 overflow-x-auto scrollbar-none">
            {["none", "bunny", "venetian", "half", "sunglasses", "cat", "hearts"].map((name) => (
              <button
                key={name}
                onClick={() => emit("ui:setMask", { name: name === "none" ? null : name })}
                className="flex w-[84px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
              >
                {name === "none" ? (
                  <div className="grid h-10 w-10 place-items-center text-xs text-white/70">—</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/masks/${name}.png`}
                    alt={name}
                    className="h-10 w-10 object-contain"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.opacity = "0.4";
                    }}
                  />
                )}
                <span className="text-[11px] text-white/80">{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MaskTray);
