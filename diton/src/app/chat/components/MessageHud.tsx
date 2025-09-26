"use client";
import { useEffect, useState, useRef } from "react";

type Line = { text:string; ts:number; dir:"out"|"in" };

export default function MessageHud(){
  const [lines,setLines]=useState<Line[]>([]);

  const endRef = useRef<HTMLDivElement>(null);
  /* P3_MSG_RESET */
  useEffect(()=>{
    const onPair = () => setLines([]);
    window.addEventListener("rtc:pair", onPair);
    return ()=> window.removeEventListener("rtc:pair", onPair);
  },[]);
  /* P3_AUTO_SCROLL */
  useEffect(()=>{ endRef.current?.scrollIntoView({ block: "end" }); }, [lines]);

  useEffect(()=>{
    const add = (dir:"out"|"in") => (e:CustomEvent)=> setLines(l=>{
      const nxt=[...l,{text:(e.detail?.text||""), ts:Date.now(), dir}].slice(-3);
      return nxt;
    });
    const sent = add("out");
    const recv = add("in");
    window.addEventListener("ditona:chat:sent", sent as any);
    window.addEventListener("ditona:chat:recv", recv as any);
    return ()=>{ window.removeEventListener("ditona:chat:sent",sent as any); window.removeEventListener("ditona:chat:recv",recv as any); };
  },[]);
  if(lines.length===0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-2 sm:inset-x-4 bottom-20 sm:bottom-24 z-[55] space-y-1">
      {lines.map((l,i)=>(
        <div key={i}
             onPointerDown={(e)=>{ e.preventDefault(); navigator.clipboard?.writeText(l.text).catch(()=>{}); }}
             className="text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-sm">
          <span className={l.dir==="in"?"text-white/80":"text-emerald-300"}>{l.dir==="in"?"• ":"▲ "}</span>
          {l.text}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
