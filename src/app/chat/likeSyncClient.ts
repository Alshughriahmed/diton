// src/app/chat/likeSyncClient.ts
/**
 * Idempotent client-side module.
 * يستقبل رسائل الإعجاب عبر قناة البيانات ويحوّلها إلى أحداث UI موحّدة.
 * لا يرسل أي بيانات. الإرسال يتم من طبقة الواجهة عند اتصال الغرفة فقط.
 */

declare global {
  interface Window {
    __likeSyncMounted?: 1;
    __ditonaDataChannel?: {
      addEventListener?: (type: "message", handler: (ev: MessageEvent) => void) => void;
      removeEventListener?: (type: "message", handler: (ev: MessageEvent) => void) => void;
      // اختيارية في الشيم:
      setSendGuard?: (fn: () => boolean) => void;
    };
  }
}

if (typeof window !== "undefined" && !window.__likeSyncMounted) {
  window.__likeSyncMounted = 1;

  const onLike = (liked: boolean) => {
    try {
      // حدث قديم للتوافق
      window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked } }));
      // حدث جديد لطبقات أخرى
      window.dispatchEvent(new CustomEvent("ditona:like:recv", { detail: { liked } }));
    } catch {}
  };

  const onDCMessage = (ev: MessageEvent) => {
    try {
      const data = ev?.data;
      if (!data) return;

      // يدعم نص/Buffer/Uint8Array
      let txt: string | null = null;
      if (typeof data === "string") txt = data;
      else if (data instanceof ArrayBuffer) txt = new TextDecoder().decode(new Uint8Array(data));
      else if (ArrayBuffer.isView(data)) txt = new TextDecoder().decode(data as any);

      if (!txt || !/^\s*\{/.test(txt)) return;
      const j = JSON.parse(txt);

      // صيغ مدعومة:
      // { t: "like", liked: true }
      // { type: "like:toggled", payload: { liked: true } }
      if (j?.t === "like" && typeof j.liked === "boolean") {
        onLike(!!j.liked);
        return;
      }
      if (j?.type === "like:toggled" && j?.payload && typeof j.payload.liked === "boolean") {
        onLike(!!j.payload.liked);
        return;
      }
    } catch {
      // تجاهل بصمت
    }
  };

  try {
    const dc = window.__ditonaDataChannel;
    if (dc?.addEventListener) {
      dc.addEventListener("message", onDCMessage);
    }
  } catch {}
}

export {};
