"use client";
import { useEffect, useRef, useState } from "react";
import { on, off } from "@/utils/events";

const EMOJIS = "😊 😀 😘 🤩 ☺️ 😋 🤪 😜 🤗 🤔 🫣 😏 😴 🤤 💋 ❤️ 💔 💯 💥 💫 💬 💦 👍 🫦 👄 👅 🧖‍♀️ 🔥 🥂 🍌 🌹 🩱 👙 🌨 🛀 💯 🥂 🏞".split(/\s+/).filter(Boolean);

export default function ChatMessagingBar(){
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [bottom, setBottom] = useState(88);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{ const a=()=>setOpen(true), b=()=>setOpen(false); on("ui:openMessaging",a); on("ui:closeMessaging",b); return ()=>{ off("ui:openMessaging",a); off("ui:closeMessaging",b); }; },[]);
  useEffect(()=>{
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if(!vv) return;
    const h = () => { const kb = Math.max(0, window.innerHeight - vv.height); setBottom(88 + (kb>0 ? kb - 12 : 0)); };
    vv.addEventListener("resize", h); vv.addEventListener("scroll", h); h();
    return ()=>{ vv.removeEventListener("resize", h); vv.removeEventListener("scroll", h); };
  },[]);

  if(!open) return null;

  const pick = (e:string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? msg.length;
    const end = el?.selectionEnd ?? start;
    const next = msg.slice(0,start)+e+msg.slice(end);
    setMsg(next);
    requestAnimationFrame(()=>{ try{ el?.setSelectionRange(start+e.length,start+e.length); el?.focus(); }catch{} });
  };
  const send = () => { const t = msg.trim(); if(!t) return; console.log("[chat:send]", t); setMsg(""); setOpen(false); };

  return (
    <div className="fixed left-24 right-24 sm:left-28 sm:right-28 z-50" style={{ bottom: `calc(env(safe-area-inset-bottom) + ${bottom}px)` }}>
      <div className="rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 shadow-lg p-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {EMOJIS.map((e,i)=>(
            <button key={i} onClick={()=>pick(e)} className="min-w-8 h-8 px-2 rounded bg-white/10 hover:bg-white/20 text-base">{e}</button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input ref={inputRef} value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); send(); } }} placeholder="Type your message here …" className="flex-1 px-3 py-2 rounded-lg bg-zinc-800/80 text-white outline-none" maxLength={500}/>
          <button onClick={send} className="px-4 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-700/80 text-white">Send</button>
        </div>
      </div>
    </div>
  );
}