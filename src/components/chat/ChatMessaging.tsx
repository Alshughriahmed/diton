/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emit } from "@/utils/events";

type Msg = { id: string; me: boolean; txt: string; at: number };

export default function ChatMessagingBar() {
  const [list, setList] = useState<Msg[]>([]);
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const [vvBottom, setVvBottom] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // تحريك الشريط مع لوحة المفاتيح على الجوال
  useEffect(() => {
    const vv = (globalThis as any).visualViewport;
    if (!vv) return;
    const onResize = () => {
      const off = Math.max(0, (window.innerHeight || 0) - (vv.height || 0));
      setVvBottom(off);
    };
    vv.addEventListener("resize", onResize);
    onResize();
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const last3 = useMemo(() => list.slice(-3), [list]);

  const send = useCallback(async () => {
    const val = txt.trim();
    if (!val || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // ملاحظة: نقطتنا الخلفية تستخدم الحقل "txt"
        body: JSON.stringify({ txt: val }),
      });
      if (res.ok) {
        setList((arr) =>
          [...arr, { id: String(Date.now()), me: true, txt: val, at: Date.now() }].slice(-50)
        );
        setTxt("");
      } else if (res.status === 429) {
        emit("ui:upsell", "messages");
        emit("ui:toast" as any, "بلغت حد الرسائل المجانية. اشترك VIP للمتابعة.");
      } else {
        emit("ui:toast" as any, "تعذّر إرسال الرسالة. حاول مجددًا.");
      }
    } catch {
      emit("ui:toast" as any, "انقطاع مؤقت. يرجى المحاولة.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [txt, busy]);

  return (
    <div
      data-messaging-bar
      className="mx-auto w-full max-w-5xl px-3"
      style={{ marginBottom: vvBottom ? vvBottom + 8 : 0 }}
      aria-label="chat-messaging-bar"
    >
      <div className="rounded-md bg-black/50 backdrop-blur-sm border border-white/10 p-2">
        <div className="flex flex-col gap-1">
          <div className="text-xs text-white/80 flex flex-col gap-0.5">
            {last3.length === 0 ? (
              <span className="opacity-80">جارٍ العثور على شريك دردشة…</span>
            ) : (
              last3.map((m) => (
                <span key={m.id}>
                  {m.me ? "أنت" : "الشريك"}: {m.txt}
                </span>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="اكتب رسالة…"
              className="flex-1 outline-none rounded bg-white/90 text-black px-3 py-2 text-sm"
              aria-label="message-input"
            />
            <button
              onClick={send}
              disabled={busy || !txt.trim()}
              className="shrink-0 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
              aria-label="send-message"
            >
              إرسال
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}