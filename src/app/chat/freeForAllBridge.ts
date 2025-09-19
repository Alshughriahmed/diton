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
