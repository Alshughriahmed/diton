// freeForAllBridge.ts
"use client";
(function(){
  let done=false;
  async function boot(){
    try{
      const r=await fetch("/api/rtc/env",{cache:"no-store"});
      const j=await r.json().catch(()=>({}));
      const ffa = !!(j?.FREE_FOR_ALL || j?.NEXT_PUBLIC_FREE_FOR_ALL);
      if(!ffa) return;
      document.documentElement.setAttribute("data-ffa","1");
      // فعّل Prev والفلاتر
      try{
        document.querySelectorAll('[data-ui="btn-prev"]').forEach((b:any)=>{ b.removeAttribute("disabled"); b.setAttribute("aria-disabled","false"); });
        document.querySelectorAll('[data-ui="filters"],[data-ui="filters-open"]').forEach((b:any)=>{ b.removeAttribute("disabled"); b.classList.remove("opacity-50","pointer-events-none"); });
      }catch{}
      window.dispatchEvent(new CustomEvent("ditona:ffa",{detail:{on:true}}));
      done=true;
    }catch{}
  }
  if(typeof window!=="undefined"){ boot(); }
})();
;(()=>{ try{
  if (typeof window==="undefined") return;
  if ((window as any).__ditonaBridgeInit) return;
  (window as any).__ditonaBridgeInit=1;
  (async()=>{ try{
    const m=await import("@/utils/events");
    const on=m.on, emit=m.emit;
    const N=["rtc:pair","rtc:phase","ditona:peer-meta"] as const;
    // window -> bus
    N.forEach((n)=>window.addEventListener(n as any,(ev:any)=>{ try{ emit(n as any,(ev as any)?.detail);}catch{} },{passive:true}));
    // bus -> window
    N.forEach((n)=>{ try{ on(n as any,(detail:any)=>{ try{ window.dispatchEvent(new CustomEvent(n as any,{detail})); }catch{} }); }catch{} });
  }catch{} })();
} catch{} })();
;(()=>{ try{
  if (typeof window==="undefined") return;
  if ((window as any).__ditonaFFALoaded) return;
  (window as any).__ditonaFFALoaded=1;
  (async()=>{ try{ const m=await import("@/utils/ffa"); await m.loadFFA?.(); }catch{} })();
} catch{} })();
