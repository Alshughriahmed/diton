"use client";
(() => {
  if (typeof window === "undefined") return;
  if ((window as any).__peerMetaUiInit) return;
  (window as any).__peerMetaUiInit = 1;

  const apply = (m:any) => {
    try {
      (window as any).__ditonaPeerMeta = m || null;
      // يعاد بثّه لواجهة React (اختياري للاستماع داخليًا)
      window.dispatchEvent(new CustomEvent("ditona:peer-meta-ui",{detail:m||null}));
    } catch {}
  };

  // استقبل meta من جسر الـDC
  window.addEventListener("ditona:peer-meta", (e:any)=> apply(e?.detail));
  // عند تصفير الزوج (stop/rematch) نظّف الحالة
  window.addEventListener("rtc:pair", (e:any) => {
    const d = e?.detail || {};
    if (!d?.pairId) apply(null);
  });
})();