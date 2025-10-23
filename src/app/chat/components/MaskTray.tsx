// src/app/chat/components/MaskTray.tsx
"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import { emit } from "@/utils/events";

type Props = { open: boolean; onClose: () => void };

// أيقونات 72–84px ضمن ارتفاع درج ~92–100px
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  // تمهيد الصور عند الفتح فقط
  useEffect(() => {
    if (!open) return;
    for (const m of MASKS) {
      if (m.id === "none") continue;
      const img = new Image();
      img.loading = "eager";
      img.decoding = "async";
      img.src = m.icon;
    }
  }, [open]);

  // منع تسرّب الإيماءات والاختصارات داخل الدرج فقط
  const stopBubble = useCallback((e: Event) => {
    e.stopPropagation();
  }, []);
  useEffect(() => {
    if (!open || !rootRef.current) return;
    const el = rootRef.current;

    const handlers: Array<[keyof GlobalEventHandlersEventMap, any]> = [
      ["touchstart", stopBubble],
      ["touchmove", stopBubble],
      ["wheel", stopBubble],
      ["pointerdown", stopBubble],
      ["keydown", (e: KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }],
    ];
    for (const [t, h] of handlers) el.addEventListener(t, h as any, { passive: t !== "keydown" });
    return () => {
      for (const [t, h] of handlers) el.removeEventListener(t, h as any);
    };
  }, [open, stopBubble, onClose]);

  const cls = useMemo(
    () =>
      // نرفع الدرج 10–12px فوق شريط الأدوات السفلي
      `fixed left-0 right-0 z-[60] transition-transform duration-200 ease-out
       ${open ? "translate-y-0" : "translate-y-full"}`,
    [open],
  );

  const bottomOffsetStyle = {
    // شريط الأدوات عند bottom: calc(safe-area + 8px)
    // نضع الدرج فوقه بـ 10–12px، ونبتعد عن أزرار Prev/Next
    bottom: "calc(env(safe-area-inset-bottom) + 72px)",
  } as const;

  const pick = (id: string) => {
    if (id === "none") emit("ui:setMask", { name: null });
    else emit("ui:setMask", { name: id });
    onClose();
  };

  const scrollBy = (dx: number) => scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div
      ref={rootRef}
      className={cls}
      style={bottomOffsetStyle}
      aria-hidden={!open}
      role="dialog"
      aria-label="Masks tray"
    >
      <div
        className="mx-auto max-w-4xl rounded-2xl bg-black/70 backdrop-blur text-white shadow-lg pointer-events-auto"
      >
        {/* شريط علوي رفيع + Close في الوسط لتفادي الضغط على ⏮️ */}
        <div className="relative px-2 py-1">
          {/* يسار: سهم تمرير */}
          <button
            onClick={() => scrollBy(-240)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-lg px-2 opacity-80 hover:opacity-100"
            aria-label="Scroll left"
          >
            ‹
          </button>

          {/* المنتصف: زر إغلاق */}
          <div className="flex items-center justify-center">
            <button
              onClick={onClose}
              className="h-7 px-3 rounded-md bg-white/10 hover:bg-white/15 border border-white/15 text-sm"
              aria-label="Close masks tray"
            >
              Close
            </button>
          </div>

          {/* يمين: سهم تمرير */}
          <button
            onClick={() => scrollBy(240)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-lg px-2 opacity-80 hover:opacity-100"
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>

        {/* محتوى الدرج: أنحف، بطاقات 72–84px */}
        <div
          ref={scrollerRef}
          className="flex gap-2 sm:gap-3 overflow-x-auto px-3 pb-3 snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {MASKS.map((m) => (
            <button
              key={m.id}
              onClick={() => pick(m.id)}
              className="snap-start shrink-0 w-[84px] h-[84px] sm:w-24 sm:h-24 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition flex flex-col items-center justify-center border border-white/10"
              aria-label={`Mask ${m.label}`}
            >
              {/* <=48px داخل البطاقة لسرعة العرض */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.icon}
                alt={m.id}
                width={48}
                height={48}
                loading="eager"
                decoding="async"
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain pointer-events-none select-none"
                draggable={false}
              />
              <div className="text-[10px] sm:text-[11px] mt-1 opacity-80">{m.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
