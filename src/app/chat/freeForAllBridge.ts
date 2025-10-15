// src/app/chat/freeForAllBridge.ts
/**
 * Idempotent side-effect module.
 * لا إطلاق تلقائي لأي أحداث مثل "ui:next".
 * يوفّر جسراً بسيطاً لأحداث الـpeer-meta نحو واجهة الشارات.
 */

if (typeof window !== "undefined" && !(window as any).__ffaBridge) {
  (window as any).__ffaBridge = 1;

  const on = (t: string, h: EventListenerOrEventListenerObject) => {
    window.addEventListener(t, h as any);
    return () => window.removeEventListener(t, h as any);
  };

  // أعِد بثّ ميتاداتا النظير إلى قناة UI القياسية
  on("ditona:peer-meta", (e: any) => {
    try {
      const detail = e?.detail ?? e;
      window.dispatchEvent(new CustomEvent("ditona:peer-meta-ui", { detail }));
    } catch {}
  });

  // حارس إرسال القناة: لا إرسال قبل اتصال الغرفة
  try {
    const dc = (window as any).__ditonaDataChannel;
    if (dc && typeof dc.setSendGuard === "function") {
      dc.setSendGuard(() => {
        const room = (window as any).__lkRoom;
        return !!room && room.state === "connected";
      });
    }
  } catch {}

  // تنظيف خفيف عند إخفاء الصفحة (لا منطق ثقيل هنا)
  on("pagehide", () => {});
}
