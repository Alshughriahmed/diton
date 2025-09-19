"use client";
(function(){
  if (typeof window === "undefined") return;
  function send(){
    try {
      const dc = (window as any).__ditonaDataChannel as RTCDataChannel | undefined;
      if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify({ type: "meta:init" }));
      }
    } catch {}
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
