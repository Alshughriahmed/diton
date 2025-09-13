"use client";
import { useEffect, useRef, useState } from "react";
import { emit } from "@/utils/events";

const EMOJIS = "😊 😀 😘 🤩 ☺️ 😋 🤪 😜 🤗 🤔 🫣 😏 😴 🤤 💋 ❤️ 💔 💯 💥 💫 💬 💦 👍 🫦 👄 👅 🧖‍♀️ 🔥 🥂 🍌 🌹 🩱 👙 🌨 🛀 💯 🥂 🏞".split(/\s+/).filter(Boolean);

export default function ChatMessaging(){
  const [msg, setMsg] = useState("");
  const [bottom, setBottom] = useState(88); // px above safe area; sits above toolbar
  const inputRef = useRef<HTMLInputElement>(null);

  // shrink safely with on-screen keyboard (mobile)
  useEffect(()=>{
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if(!vv) return;
    const h = () => {
      // keep bar visible above keyboard
      const kb = Math.max(0, (window.innerHeight - vv.height));
      setBottom(88 + (kb>0 ? kb - 12 : 0));
    };
    vv.addEventListener("resize", h);
    vv.addEventListener("scroll", h);
    h();
    return ()=>{ vv.removeEventListener("resize", h); vv.removeEventListener("scroll", h); };
  },[]);

  const onPick = (e:string) => {
    const el = inputRef.current;
    if(!el) { setMsg(m=>m+e); return; }
    const start = el.selectionStart ?? msg.length;
    const end = el.selectionEnd ?? start;
    const next = msg.slice(0,start)+e+msg.slice(end);
    setMsg(next);
    requestAnimationFrame(()=>{ try{ el.setSelectionRange(start+e.length,start+e.length); el.focus(); }catch{} });
  };

  const onSend = () => {
    const t = msg.trim();
    if(!t) return;
    // Hook نقطة تمرير لاحقة: يمكن ربطها بـ MessageSystem/WebRTC
    console.log("[chat:send]", t);
    setMsg("");
    emit("ui:closeMessaging");
  };

  return (
    <div
      data-messaging-bar
      className="fixed left-24 right-24 sm:left-28 sm:right-28 z-50"
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${bottom}px)` }}
    >
      <div className="rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 shadow-lg p-2">
        {/* emoji row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {EMOJIS.map((e,i)=>(
            <button key={i} onClick={()=>onPick(e)} className="min-w-8 h-8 px-2 rounded bg-white/10 hover:bg-white/20 text-base">{e}</button>
          ))}
        </div>
        {/* input + send */}
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={inputRef}
            value={msg}
            onChange={e=>setMsg(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); onSend(); } }}
            placeholder="Type your message here …"
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-800/80 text-white outline-none"
            maxLength={500}
          />
          <button onClick={onSend} className="px-4 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-700/80 text-white">Send</button>
        </div>
      </div>
    </div>
  );
}
