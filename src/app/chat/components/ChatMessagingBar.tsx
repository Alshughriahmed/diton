"use client";
import { useEffect, useRef, useState } from "react";
import { emit } from "@/utils/events";

const EMOJIS = ["😊","😀","😘","🤩","☺️","😋","🤪","😜","🤗","🤔","🫣","😏","😴","🤤","💋","❤️","💔","💯","💥","💫","💬","💦","👍","🫦","👄","👅","🧖‍♀️","🔥","🥂","🍌","🌹","🩱","👙","🌨","🛀","🏞"];

export default function ChatMessagingBar(){
  const [open,setOpen]=useState(false);
  const [text,setText]=useState("");
  const [showEmoji,setShowEmoji]=useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // open/close by toolbar and msgbar:toggle events
  useEffect(()=>{
    const onOpen = ()=>setOpen(true);
    const onClose= ()=>{ setOpen(false); setShowEmoji(false); };
    const onToggle = ()=>{ setOpen(prev => !prev); if(open) setShowEmoji(false); };
    
    // Support existing events for compatibility
    window.addEventListener("ui:openMessaging", onOpen as any);
    window.addEventListener("ui:closeMessaging", onClose as any);
    // Support new toggle event
    window.addEventListener("msgbar:toggle", onToggle as any);
    
    return ()=>{ 
      window.removeEventListener("ui:openMessaging",onOpen as any); 
      window.removeEventListener("ui:closeMessaging",onClose as any);
      window.removeEventListener("msgbar:toggle",onToggle as any);
    };
  },[open]);

  // keep above keyboard using visualViewport
  useEffect(()=>{
    const vv:any = (window as any).visualViewport;
    if(!vv) return;
    const handler=()=>{
      if(!barRef.current) return;
      const bottom = Math.max(8, (vv.height < window.innerHeight ? (window.innerHeight - vv.height + 8) : 8));
      barRef.current.style.bottom = `calc(env(safe-area-inset-bottom) + ${bottom}px)`;
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    handler();
    return ()=>{ vv.removeEventListener("resize", handler); vv.removeEventListener("scroll", handler); };
  },[]);

  const send = ()=>{
    const t = text.trim();
    if(!t) return;
    console.log('[chat:send]', t);
    // HUD hook: يبقى نصيًا بلا صناديق
    window.dispatchEvent(new CustomEvent("ditona:chat:sent",{detail:{text:t, ts:Date.now()}}));
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  return (
    <div ref={barRef} data-ui="messaging-bar"
         className={`fixed left-0 right-0 z-[70] pointer-events-auto transition-all duration-200 ${
           open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
         }`}
         style={{bottom:"calc(env(safe-area-inset-bottom)+8px)"}}>
      <div className="relative mx-2 sm:mx-4 rounded-2xl bg-black/45 backdrop-blur border border-white/15 px-3 py-2">
        {/* emoji drawer inside container */}
        {showEmoji && (
          <div className="absolute bottom-full left-0 right-0 mb-2 mx-auto max-w-[min(92vw,640px)]">
            <div className="rounded-2xl bg-black/60 backdrop-blur border border-white/10 px-2 py-1 overflow-x-auto whitespace-nowrap">
              {EMOJIS.map(e=>(
                <button key={e} className="px-1.5 py-1 text-xl hover:bg-white/10 rounded" onClick={()=>setText(t=>t+e)}>{e}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* emoji toggle left */}
          <button aria-label="Emoji" onClick={()=>setShowEmoji(v=>!v)}
                  className={`w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-colors ${showEmoji ? 'bg-white/20' : ''}`}>🙂</button>

          {/* input */}
          <input
            value={text}
            onChange={e=>setText(e.target.value)}
            onFocus={()=>setShowEmoji(false)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here ..."
            className="flex-1 h-10 rounded-xl bg-zinc-800/70 text-white px-3 outline-none border border-white/10 focus:border-white/30 transition-colors"/>

          {/* send on right */}
          <button aria-label="Send" onClick={send}
                  className="w-12 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">➤</button>
        </div>
      </div>
    </div>
  );
}