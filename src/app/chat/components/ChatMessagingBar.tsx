"use client";

import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";

export default function ChatMessagingBar() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // استماع لحافلة الأحداث الداخلية (بدلاً من window)
  useEffect(() => {
    const off1 = on("ui:openMessaging" as any, () => setOpen(true));
    const off2 = on("ui:closeMessaging" as any, () => setOpen(false));
    return () => { try { off1?.(); off2?.(); } catch {} };
  }, []);

  // دعم أزرار قديمة لا تطلق events (data-ui="msg-toggle")
  useEffect(() => {
    const h = (e: any) => {
      const el = e?.target as HTMLElement | null;
      if (!el) return;
      const hit = el.closest?.('[data-ui="msg-toggle"]');
      if (hit) {
        setOpen((v) => !v);
        emit((open ? "ui:closeMessaging" : "ui:openMessaging") as any);
      }
    };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, [open]);

  // رفع الشريط فوق لوحة المفاتيح على الموبايل
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv: any = (window as any).visualViewport;
    if (!vv) return;
    const adjust = () => {
      const offset = Math.max(0, vv.height + vv.offsetTop - window.innerHeight);
      if (ref.current) ref.current.style.bottom = `${offset}px`;
    };
    adjust();
    vv.addEventListener("resize", adjust);
    vv.addEventListener("scroll", adjust);
    return () => { vv.removeEventListener("resize", adjust); vv.removeEventListener("scroll", adjust); };
  }, []);

  if (!open) return null;

  return (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-[60] pointer-events-auto">
      <div className="mx-auto max-w-3xl bg-black/60 backdrop-blur rounded-t-2xl p-2">
        <div className="flex gap-2 items-center">
          <input
            data-ui="msg-input"
            className="flex-1 rounded-xl bg-black/40 text-white placeholder-white/60 px-3 py-2 outline-none"
            placeholder="Type a message…"
          />
          <button
            data-ui="msg-send"
            className="rounded-xl px-3 py-2 bg-blue-600 text-white"
            onClick={() => {/* TODO: hook send */}}
          >Send</button>
          <button
            data-ui="msg-close"
            className="rounded-xl px-3 py-2 bg-black/40 text-white"
            onClick={() => { setOpen(false); emit("ui:closeMessaging" as any); }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}