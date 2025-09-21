"use client";
(function(){
  if (typeof window === "undefined") return;
  function send(){
    const w = typeof window !== "undefined" ? (window as any) : undefined;
    const dc = w?.__ditonaDataChannel as RTCDataChannel | undefined;
    if (dc) {
      try { dc.send(JSON.stringify({ type: "meta:init" })); } catch {}
      setTimeout(()=>{ try { dc.send(JSON.stringify({ type: "meta:init" })); } catch {} }, 300);
      setTimeout(()=>{ try { dc.send(JSON.stringify({ type: "meta:init" })); } catch {} }, 1200);
    }
  }
  function onPhase(e:any){
    try {
      if (e && e.detail && e.detail.phase === "connected") {
        setTimeout(send, 0); setTimeout(send, 300);
      }
    } catch {}
  }
  window.addEventListener("rtc:phase", onPhase);
})();
