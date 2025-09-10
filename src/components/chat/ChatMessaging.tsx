"use client";
import { useEffect, useRef, useState } from "react";

const EMOJIS = ["😋","😜","🤗","😊","😏","🤭","😬","😳","😍","🥰","💔","🫦","🍒","⚘️","🔥","🎆","🌈","💦","💫","💋","😈","🫶","👍","🍦","🍺","✨️","🖕","💨","💧","🩱","👙","💯"];

export default function ChatMessagingBar({ onSend }: { onSend?: (m: string) => void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, []);

  function send() {
    const v = text.trim();
    if (!v) return;
    onSend?.(v);
    setText("");
  }

  return (
    <div className="fixed inset-x-2 bottom-[max(env(safe-area-inset-bottom),0.5rem)] z-[60] pointer-events-none">
      <div className="mx-auto max-w-5xl rounded-xl bg-black/35 backdrop-blur-sm border border-white/10 p-2 flex items-center gap-2 pointer-events-auto">
        {/* Emoji (left) */}
        <div className="relative">
          <button aria-label="emoji" onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg hover:bg-white/10">😊</button>
          {open && (
            <div className="absolute bottom-full mb-2 left-0 max-h-40 w-64 overflow-auto rounded-xl bg-black/90 border border-white/10 p-2 grid grid-cols-8 gap-1 z-[70]">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => { setText((t) => t + e); setOpen(false); inputRef.current?.focus(); }}
                  className="text-xl leading-6 hover:scale-110"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-transparent outline-none placeholder:text-slate-300/60 px-2 py-2"
        />

        {/* Send (right) */}
        <button onClick={send} className="px-3 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 active:scale-95">
          Send
        </button>
      </div>
    </div>
  );
}
