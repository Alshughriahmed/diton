// src/app/chat/dcMetaResponder.client.ts
/**
 * جسر LiveKit Data → window events.
 * يتعامل فقط مع topic="meta" و topic="like" ويُهمل غير ذلك.
 * يمنع الحلقات بإزالة أي إعادة بث محلية.
 */
if (typeof window !== "undefined" && !(window as any).__dcMetaResponderMounted) {
  (window as any).__dcMetaResponderMounted = 1;

  const parse = (b: ArrayBuffer | Uint8Array | string) => {
    try {
      if (typeof b === "string") return JSON.parse(b);
      const u8 = b instanceof Uint8Array ? b : new Uint8Array(b as ArrayBuffer);
      return JSON.parse(new TextDecoder().decode(u8));
    } catch { return null; }
  };

  const dispatch = (name: string, detail: any) => {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  };

  const room: any = (window as any).__lkRoom;
  if (room?.on) {
    room.on("dataReceived", (payload: Uint8Array, _p: any, _kind: any, topic?: string) => {
      if (topic !== "meta" && topic !== "like") return;       // أهم سطر
      const j = parse(payload);
      if (!j || typeof j !== "object") return;

      // peer meta
      if (j.t === "peer-meta" && j.payload) {
        dispatch("ditona:peer-meta", j.payload);
        return;
      }

      // طلب الميتا
      if (j.t === "meta:init") {
        dispatch("ditona:meta:init", {});
        return;
      }

      // مزامنة الإعجاب
      if (j.t === "like:sync" && (typeof j.count === "number" || typeof j.you === "boolean")) {
        dispatch("like:sync", { count: j.count, you: j.you, pairId: j.pairId });
        return;
      }

      // الشكل القديم {t:"like", liked:boolean}
      if (j.t === "like" && typeof j.liked === "boolean") {
        dispatch("rtc:peer-like", { liked: !!j.liked });
      }
    });
  }
}
export {};
