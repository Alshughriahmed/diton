"use client";
import { useEffect, useRef, useState } from "react";

const EMOJIS = ["😋","😜","🤗","😊","😏","🤭","😬","😳","😍","🥰","💔","🫦","🍒","⚘️","🔥","🎆","🌈","💦","💫","💋","😈","🫶","👍","🍦","🍺","✨️","🖕","💨","💧","🩱","👙","💯"];

export default function ChatMessagingBar({ onSend }: { onSend?: (m: string) => void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{id: number, me: boolean, text: string}>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, []);

  async function send() {
    const v = text.trim();
    if (!v) return;
    
    // Send to API and show local echo on success
    try {
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: v })
      });
      
      if (response.ok) {
        // Show local echo
        appendLocalAfterSend(setMessages, v);
      }
    } catch (error) {
      console.warn('Message send failed:', error);
    }
    
    onSend?.(v);
    setText("");
  }

  /* ensure local echo after successful POST */
  function appendLocalAfterSend(listSetter: any, text: string) {
    listSetter((prev: any[]) => [...prev.slice(-2), { id: Date.now(), me: true, text }]);
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

      {/* Messages display (last 3) */}
      {messages.length > 0 && (
        <div className="absolute bottom-full mb-2 right-0 max-w-xs space-y-1">
          {messages.slice(-3).map((msg) => (
            <div
              key={msg.id}
              className={`px-3 py-2 rounded-lg text-sm backdrop-blur-sm border ${
                msg.me 
                  ? 'bg-emerald-600/80 border-emerald-500/50 text-white ml-8' 
                  : 'bg-slate-700/80 border-slate-600/50 text-slate-100 mr-8'
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
