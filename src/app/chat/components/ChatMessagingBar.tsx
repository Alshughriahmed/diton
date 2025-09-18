"use client";

import { useEffect, useRef, useState } from "react";
import { on, emit } from "@/utils/events";

export default function ChatMessagingBar() {
  const [text,setText]=useState("");
  const [pairId,setPairId]=useState<string>("");

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // استماع لحافلة الأحداث الداخلية (بدلاً من window)
  useEffect(() => {
    const off1 = on("ui:openMessaging" as any, () => setOpen(true));
    const off2 = on("ui:closeMessaging" as any, () => setOpen(false));
    const off3 = on("rtc:pair" as any, (d: any) => { if (d?.pairId) setPairId(String(d.pairId)); });
    return () => { try { off1?.(); off2?.(); off3?.(); } catch {} };
  }, []);

  async function sendMessage() {
    const msg = (text || "").trim(); if (!msg) return;
    const ok = await fetch('/api/message/allow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pairId }) }).then(r => r.ok).catch(() => false);
    if (!ok) { try { window.dispatchEvent(new CustomEvent('ui:upsell', { detail: { feature: 'messages' } })); } catch {} return; }
    const dc = (globalThis as any).__ditonaDataChannel;
    if (dc?.readyState === 'open') { dc.send(JSON.stringify({ t: 'chat', pairId, text: msg })); }
    try { window.dispatchEvent(new CustomEvent('ditona:chat:sent', { detail: { text: msg } })); } catch {}
    setText("");
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

  useEffect(() => {
    const prevent = (e:any)=>{ try{ const a=document.activeElement as any; if(a && (a.tagName==="INPUT"||a.tagName==="TEXTAREA")) e.preventDefault(); }catch{} };
    const onF=()=>{ try{ window.addEventListener("touchmove", prevent, {passive:false}); }catch{} };
    const onB=()=>{ try{ window.removeEventListener("touchmove", prevent); }catch{} };
    document.addEventListener("focusin", onF);
    document.addEventListener("focusout", onB);
    return ()=>{ document.removeEventListener("focusin", onF); document.removeEventListener("focusout", onB); window.removeEventListener("touchmove", prevent); };
  }, []);

  useEffect(() => {
    const preventNavIfTyping = (e:any) => {
      try {
        const a=document.activeElement as any; const t=e.target as HTMLElement | null;
        const typing = a && (a.tagName==="INPUT"||a.tagName==="TEXTAREA");
        if (!typing || !t) return;
        const hit = t.closest?.('[data-ui="btn-next"], [data-ui="btn-prev"]');
        if (hit) { e.preventDefault(); e.stopPropagation(); }
      } catch {}
    };
    document.addEventListener("click", preventNavIfTyping, true);
    return ()=> document.removeEventListener("click", preventNavIfTyping, true);
  }, []);



  if (!open) return null;

  return (
    "<".div." "."ref={ref} className="fixed bottom-0 left-0 right-0 z-[70] fixed inset-x-0 bottom-0 z-[70] pointer-events-auto"" data-ui="messages-fixed">
      "<".div." "."className="mx-auto max-w-3xl bg-black/60 backdrop-blur rounded-t-2xl p-2 fixed inset-x-0 bottom-0 z-[70] pointer-events-auto"">
        "<".div." "."className="flex gap-2 items-center fixed inset-x-0 bottom-0 z-[70] pointer-events-auto"">
          "<".input." "."data-ui="msg-input"
            className="flex-1 rounded-xl bg-black/40 text-white placeholder-white/60 px-3 py-2 outline-none fixed inset-x-0 bottom-0 z-[70] pointer-events-auto""
            placeholder="Type a message…"
            value={text} 
            onChange={e => setText(e.target.value)} 
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            onFocus={() => { try { emit("ui:typing" as any, "on"); } catch {} }}
            onBlur={() => { try { emit("ui:typing" as any, "off"); } catch {} }}
          />
          "<".button." "."data-ui="msg-send"
            className="rounded-xl px-3 py-2 bg-blue-600 text-white fixed inset-x-0 bottom-0 z-[70] pointer-events-auto""
            onClick={() => sendMessage()}
          >Send</button>
          "<".button." "."data-ui="msg-close"
            className="rounded-xl px-3 py-2 bg-black/40 text-white fixed inset-x-0 bottom-0 z-[70] pointer-events-auto""
            onClick={() => { setOpen(false); emit("ui:closeMessaging" as any); }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}