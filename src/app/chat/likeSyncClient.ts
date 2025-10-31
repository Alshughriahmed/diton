/**
 * جسر موضوع "like" عبر LiveKit → أحداث نافذة.
 * Forwards:
 *   {t:"like:sync", count, you, pairId?} -> window "like:sync"
 *   {t:"like", liked}                     -> window "rtc:peer-like"
 * Injects current pairId when missing.
 */
if (typeof window !== "undefined" && !(window as any).__likeSyncMounted) {
  (window as any).__likeSyncMounted = 1;

  const curPair = (): string | null => {
    try {
      const w: any = window as any;
      return w.__ditonaPairId || w.__pairId || null;
    } catch { return null; }
  };

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

  function attach(room: any) {
    if (!room || !room.on) return;

    const onData = (payload: Uint8Array, _p?: any, _k?: any, topic?: string) => {
      if (topic !== "like") return;
      const j = parse(payload);
      if (!j || typeof j !== "object") return;

      if (j.t === "like:sync") {
        dispatch("like:sync", {
          count: typeof j.count === "number" ? j.count : undefined,
          you: typeof j.you === "boolean" ? j.you : undefined,
          pairId: j.pairId || curPair(),
        });
        return;
      }

      if (j.t === "like" && typeof j.liked === "boolean") {
        dispatch("rtc:peer-like", { liked: !!j.liked, pairId: j.pairId || curPair() });
      }
    };

    room.on("dataReceived", onData);
    window.addEventListener("pagehide", () => {
      try { room.off("dataReceived", onData); } catch {}
    }, { once: true } as any);
  }

  attach((window as any).__lkRoom);
  window.addEventListener("lk:attached", () => attach((window as any).__lkRoom), { passive: true } as any);
}
export {};
