/**
 * مزامنة إعجاب عبر قناة البيانات:
 * - تحويل {t:"like"} إلى like:sync خفيفة.
 * - تمرير {t:"like:sync"} كما هي مع إرفاق pairId الحالي.
 */
(function mountOnce() {
  if (typeof window === "undefined") return;
  const w: any = window as any;
  if (w.__likeSyncMounted) return;
  w.__likeSyncMounted = 1;

  const curPair = () => (w.__ditonaPairId || w.__pairId || null);

  function parse(ev: MessageEvent): any | null {
    const d: any = (ev as any).data;
    let s: string | null = null;
    if (typeof d === "string") s = d;
    else if (d instanceof ArrayBuffer) s = new TextDecoder().decode(d);
    else if (ArrayBuffer.isView(d)) s = new TextDecoder().decode(d as any);
    if (!s || !/^\s*\{/.test(s)) return null;
    try { return JSON.parse(s); } catch { return null; }
  }

  const onMsg = (ev: MessageEvent) => {
    const j = parse(ev);
    if (!j) return;

    if (j.t === "like" && typeof j.liked === "boolean") {
      try {
        window.dispatchEvent(new CustomEvent("like:sync", {
          detail: { pairId: curPair(), likedByOther: !!j.liked, liked: !!j.liked }
        }));
      } catch {}
      return;
    }

    if (j.t === "like:sync" && (typeof j.count === "number" || typeof j.liked === "boolean")) {
      try {
        window.dispatchEvent(new CustomEvent("like:sync", {
          detail: { pairId: curPair(), count: j.count, likedByOther: !!j.liked }
        }));
      } catch {}
      return;
    }

    if (j.t === "peer-meta" && j.payload) {
      try { window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: j.payload })); } catch {}
    }

    if (j.t === "meta:init") {
      try { window.dispatchEvent(new CustomEvent("ditona:meta:init")); } catch {}
    }
  };

  try {
    const dc = w.__ditonaDataChannel;
    dc?.addEventListener?.("message", onMsg);
  } catch {}

  window.addEventListener("pagehide", () => {
    try {
      const dc = w.__ditonaDataChannel;
      dc?.removeEventListener?.("message", onMsg);
    } catch {}
  }, { once: true } as any);
})();
export {};
