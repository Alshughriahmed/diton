// src/app/chat/msgSendClient.ts
/**
 * Idempotent client module for chat messaging over LiveKit Data.
 * - Listens to DC "message" and emits "ditona:chat:recv".
 * - Sends on "ditona:chat:send" events.
 * - Falls back to shim .send() if room.publishData is unavailable.
 */

declare global {
  interface Window {
    __msgSendMounted?: 1;
  }
}

function parseJSONFromDC(ev: MessageEvent) {
  const d = ev?.data;
  let s: string | null = null;
  if (typeof d === "string") s = d;
  else if (d instanceof ArrayBuffer) s = new TextDecoder().decode(new Uint8Array(d));
  else if (ArrayBuffer.isView(d)) s = new TextDecoder().decode(d as any);
  if (!s || !/^\s*\{/.test(s)) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function sendChat(text: string): Promise<boolean> {
  if (!text || !text.trim()) return false;
  const payloadObj = { t: "chat", text: String(text).slice(0, 2000) };
  const payloadTxt = JSON.stringify(payloadObj);
  const payloadBin = new TextEncoder().encode(payloadTxt);

  const room = (window as any).__lkRoom;
  if (room && room.state === "connected" && room.localParticipant?.publishData) {
    try {
      await room.localParticipant.publishData(payloadBin, { reliable: true, topic: "chat" });
      return true;
    } catch {
      // fall through
    }
  }
  const dc = (window as any).__ditonaDataChannel;
  if (dc?.send) {
    try {
      dc.send(payloadTxt);
      return true;
    } catch {
      // ignore
    }
  }
  return false;
}

if (typeof window !== "undefined" && !window.__msgSendMounted) {
  window.__msgSendMounted = 1;

  // Incoming messages
  const onDCMessage = (ev: MessageEvent) => {
    const j = parseJSONFromDC(ev);
    if (!j) return;

    // Supported inbound formats:
    // { t: "chat", text: "..." }
    // { type: "chat", payload: { text: "..." } }
    let txt: string | undefined;
    if (j?.t === "chat" && typeof j.text === "string") txt = j.text;
    else if (j?.type === "chat" && j?.payload && typeof j.payload.text === "string") txt = j.payload.text;

    if (txt && txt.length) {
      window.dispatchEvent(new CustomEvent("ditona:chat:recv", { detail: { text: txt } }));
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

  // Outgoing messages via UI event
  const onSend = async (e: Event) => {
    try {
      const detail = (e as CustomEvent)?.detail;
      const text = typeof detail?.text === "string" ? detail.text : "";
      await sendChat(text);
    } catch {
      // ignore
    }
  };

  window.addEventListener("ditona:chat:send", onSend as any);

  // Cleanup on pagehide
  window.addEventListener(
    "pagehide",
    () => {
      try {
        const dc = (window as any).__ditonaDataChannel;
        dc?.removeEventListener?.("message", onDCMessage);
        window.removeEventListener("ditona:chat:send", onSend as any);
      } catch {}
    },
    { once: true }
  );
}

export {};
