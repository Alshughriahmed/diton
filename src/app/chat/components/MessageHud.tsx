"use client";
import { useEffect, useState, useRef } from "react";
import { emit } from "@/utils/events";

type Line = { text:string; ts:number; dir:"out"|"in" };

export default function MessageHud(){
  const [lines,setLines]=useState<Line[]>([]);
  /* P3_AUTO_SCROLL */
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [lines]);
  
  /* P4A_MSG_RESET_ENHANCED */
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);
  
  useEffect(() => {
    function onPair(event: any) { 
      const pairId = event.detail?.pairId || event?.pairId || null;
      setCurrentPairId(pairId);
      setLines([]); // Clear messages immediately
      // Emit reset event before subscribing to new messages 
      if (pairId) {
        emit('ui:msg:reset' as any, { pairId });
      }
    }
    window.addEventListener('rtc:pair', onPair);
    return () => window.removeEventListener('rtc:pair', onPair);
  }, []);
  
  /* P4A_GHOST_MESSAGE_GUARD */
  useEffect(()=>{
    const add = (dir:"out"|"in") => (e:CustomEvent)=> {
      // Guard against ghost messages from previous peer
      const messagePairId = e.detail?.pairId;
      if (messagePairId && currentPairId && messagePairId !== currentPairId) {
        console.log('[P4A] Blocked ghost message from previous pair:', messagePairId);
        return; // Ignore messages from previous pairId
      }
      
      setLines(l=>{
        const nxt=[...l,{text:(e.detail?.text||""), ts:Date.now(), dir}].slice(-3);
        return nxt;
      });
    };
    const sent = add("out");
    const recv = add("in");
    window.addEventListener("ditona:chat:sent", sent as any);
    window.addEventListener("ditona:chat:recv", recv as any);
    return ()=>{ window.removeEventListener("ditona:chat:sent",sent as any); window.removeEventListener("ditona:chat:recv",recv as any); };
  },[currentPairId]); // Re-run when currentPairId changes
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