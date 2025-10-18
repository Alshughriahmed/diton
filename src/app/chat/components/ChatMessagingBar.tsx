// src/app/chat/components/ChatMessagingBar.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";
import { toast } from "@/lib/ui/toast";

export default function ChatMessagingBar() {
  const [text, setText] = useState("");
  const [pairId, setPairId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // احصل على pairId الحالي عند الاقلاع ومن حدث rtc:pair
  useEffect(() => {
    try {
      const w: any = window as any;
      const bootPid = w.__ditonaPairId || w.__pairId || "";
      if (bootPid) setPairId(String(bootPid));
    } catch {}

    const offOpen = on("ui:openMessaging" as any, () => setOpen(true));
    const offClose = on("ui:closeMessaging" as any, () => setOpen(false));
    const offPair = on("rtc:pair" as any, (d: any) => {
      if (d?.pairId) setPairId(String(d.pairId));
    });
    return () => { try { offOpen(); offClose(); offPair(); } catch {} };
  }, []);

  async function sendMessage() {
    const msg = String(text ?? "").trim();
    if (!msg) return;

    const room: any = (window as any).__lkRoom;
    if (!room || room.state !== "connected") {
      toast("Not connected");
      return;
    }
    const pid =
      pairId ||
      (window as any).__ditonaPairId ||
      (window as any).__pairId ||
      "";

    if (!pid) {
      toast("No active pair");
      return;
    }

    // بروتوكول موحّد: ارسل كحدث وسيقوم msgSendClient بالنشر عبر LiveKit
    try {
      window.dispatchEvent(
        new CustomEvent("ditona:chat:send", { detail: { text: msg, pairId: pid } })
      );
      setText("");
    } catch {}
  }

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
    const vv: any = (window as any).visualViewport;
    if (!vv) return;
    const adjust = () => {
      const offset = Math.max(0, vv.height + vv.offsetTop - window.innerHeight);
      if (barRef.current) barRef.current.style.bottom = `${offset}px`;
    };
    adjust();
    vv.addEventListener("resize", adjust);
    vv.addEventListener("scroll", adjust);
    return () => {
      vv.removeEventListener("resize", adjust);
      vv.removeEventListener("scroll", adjust);
    };
  }, []);

  // منع سحب الصفحة أثناء الكتابة على الموبايل
  useEffect(() => {
    const prevent = (e: any) => {
      try {
        const a = document.activeElement as any;
        if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) e.preventDefault();
      } catch {}
    };
    const onF = () => { try { window.addEventListener("touchmove", prevent, { passive: false }); } catch {} };
    const onB = () => { try { window.removeEventListener("touchmove", prevent); } catch {} };
    document.addEventListener("focusin", onF);
    document.addEventListener("focusout", onB);
    return () => {
      document.removeEventListener("focusin", onF);
      document.removeEventListener("focusout", onB);
      window.removeEventListener("touchmove", prevent);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      ref={barRef}
      data-ui="messages-fixed"
      className="fixed inset-x-0 bottom-0 z-[70] pointer-events-auto mx-auto max-w-3xl bg-black/60 backdrop-blur rounded-t-2xl p-2"
    >
      <div className="flex gap-2 items-center">
        <input
          data-ui="msg-input"
          className="flex-1 rounded-xl bg-black/40 text-white placeholder-white/60 px-3 py-2 outline-none"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          onFocus={() => { try { emit("ui:typing" as any, "on"); } catch {} }}
          onBlur={() => { try { emit("ui:typing" as any, "off"); } catch {} }}
        />
        <button
          data-ui="msg-send"
          className="rounded-xl px-3 py-2 bg-blue-600 text-white"
          onClick={sendMessage}
        >
          Send
        </button>
        <button
          data-ui="msg-close"
          className="rounded-xl px-3 py-2 bg-black/40 text-white"
          onClick={() => { setOpen(false); emit("ui:closeMessaging" as any); }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
