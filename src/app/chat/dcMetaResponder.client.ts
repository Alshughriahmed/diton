// src/app/chat/dcMetaResponder.client.ts
/**
 * Idempotent DC consumer for peer metadata.
 * - Listens to DataChannel "message"
 * - Dispatches "ditona:peer-meta" when remote meta arrives
 * - Responds to "meta:init" by sending our lightweight meta
 */

if (typeof window !== "undefined" && !(window as any).__dcMetaResponderMounted) {
  (window as any).__dcMetaResponderMounted = 1;

  const sendOverDC = async (obj: any) => {
    try {
      const txt = JSON.stringify(obj);
      const room = (window as any).__lkRoom;
      if (room && room.state === "connected" && room.localParticipant?.publishData) {
        const bin = new TextEncoder().encode(txt);
        await room.localParticipant.publishData(bin, { reliable: true, topic: "meta" });
        return true;
      }
      const dc = (window as any).__ditonaDataChannel;
      if (dc?.send) {
        dc.send(txt);
        return true;
      }
    } catch {}
    return false;
  };

  const getLocalMeta = () => {
    let country: string | undefined;
    let city: string | undefined;
    try {
      const geo = JSON.parse(localStorage.getItem("ditona_geo") || "null");
      if (geo?.country) country = String(geo.country).toUpperCase();
      if (geo?.city) city = String(geo.city);
    } catch {}
    let gender: string | undefined;
    try {
      const g = localStorage.getItem("ditona_gender");
      if (g && (g === "male" || g === "female" || g === "u")) gender = g;
    } catch {}
    return { country, city, gender };
  };

  const onDCMessage = (ev: MessageEvent) => {
    try {
      const d = ev?.data;
      let s: string | null = null;
      if (typeof d === "string") s = d;
      else if (d instanceof ArrayBuffer) s = new TextDecoder().decode(new Uint8Array(d));
      else if (ArrayBuffer.isView(d)) s = new TextDecoder().decode(d as any);
      if (!s || !/^\s*\{/.test(s)) return;

      const j = JSON.parse(s);

      // Remote peer meta → UI bus
      // Supported:
      // { t: "peer-meta", payload: {...} }
      // { type: "peer-meta", payload: {...} }
      if ((j?.t === "peer-meta" || j?.type === "peer-meta") && j?.payload) {
        window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: j.payload }));
        return;
      }

      // Meta init request → reply with our meta
      if (j?.t === "meta:init" || j?.type === "meta:init") {
        const payload = getLocalMeta();
        sendOverDC({ t: "peer-meta", payload });
        return;
      }
    } catch {
      // ignore
    }
  };

  try {
    const dc = (window as any).__ditonaDataChannel;
    dc?.addEventListener?.("message", onDCMessage);
    dc?.setSendGuard?.(() => {
      const room = (window as any).__lkRoom;
      return !!room && room.state === "connected";
    });
  } catch {}

  // Cleanup
  window.addEventListener(
    "pagehide",
    () => {
      try {
        const dc = (window as any).__ditonaDataChannel;
        dc?.removeEventListener?.("message", onDCMessage);
      } catch {}
    },
    { once: true }
  );
}

export {};
