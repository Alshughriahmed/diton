// src/app/chat/components/MaskTray.tsx
"use client";

import { memo, useEffect } from "react";
import { emit } from "@/utils/events";

type MaskTrayProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * IMPORTANT:
 * - استخدم الاسم "heart-eyes" وليس "hearts" ليتطابق مع الملفات الفعلية.
 * - وجود PNG و SVG لنفس الاسم لا يسبب مشكلة؛ السطر onError يحاول png ثم webp ثم svg.
 */
const MASKS = [
  "bunny",
  "venetian",
  "half",
  "sunglasses",
  "cat",
  "heart-eyes",
  "glasses",
  "guy",
] as const;

function MaskTray({ open, onClose }: MaskTrayProps) {
  // إغلاق عبر ESC على العميل فقط
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") onClose();
    };
    if (typeof window !== "undefined") window.addEventListener("keydown", onEsc);
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  // بث فتح/إغلاق الدرج
  useEffect(() => {
    emit(open ? "ui:maskTrayOpen" : "ui:maskTrayClose");
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-x-0 bottom-0 z-40 transition-opacity duration-150 ease-out ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="pointer-events-auto mx-auto mb-2 max-w-[min(680px,100%)] rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl">
        {/* زر إغلاق داخل الشريط ويختفي عند الإغلاق */}
        {open && (
          <div className="flex justify-center pt-1.5">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white/90 text-black text-sm font-medium shadow"
            >
              Close
            </button>
          </div>
        )}

        {/* قائمة الماسكات — شريط أنحف */}
        <div className="h-16 sm:h-20 px-2 pb-2">
          <div className="flex h-full items-center gap-2 overflow-x-auto scrollbar-none">
            {/* None */}
            <button
              key="none"
              onClick={() => emit("ui:setMask", { name: null })}
              className="flex w-[80px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/masks/none.svg"
                alt="none"
                className="h-9 w-9 object-contain"
              />
              <span className="text-[11px] text-white/80">none</span>
            </button>

            {/* بقية الماسكات */}
            {MASKS.map((name) => (
              <button
                key={name}
                onClick={() => emit("ui:setMask", { name })}
                className="flex w-[80px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/masks/${encodeURIComponent(name)}.png`}
                  alt={name}
                  className="h-9 w-9 object-contain"
                  data-exti="0"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    const exts = ["png", "webp", "svg"];
                    let i = Number(el.dataset.exti || "0");
                    i += 1;
                    if (i < exts.length) {
                      el.dataset.exti = String(i);
                      el.src = `/masks/${encodeURIComponent(name)}.${exts[i]}`;
                    } else {
                      // ضع شفافية خفيفة للدلالة على فشل التحميل
                      (el.parentElement as HTMLElement).style.opacity = "0.4";
                    }
                  }}
                />
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
