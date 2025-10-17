"use client";

/**
 * Chat sender over LiveKit Data (outbound only).
 * - Listens to 'ditona:chat:send' {text}
 * - Sends via room.localParticipant.publishData(topic='chat') or DC shim fallback.
 * - Emits 'ditona:chat:sent' on success.
 * Receiving path is handled in ChatClient(RoomEvent.DataReceived) to avoid duplicates.
 */

declare global {
  interface Window { __msgSendMounted2?: 1 }
}

type SendDetail = { text: string };

async function sendChat(text: string): Promise<boolean> {
  const t = (text || "").trim();
  if (!t) return false;

  const payloadTxt = JSON.stringify({ t: "chat", text: t.slice(0, 2000) });
  const payloadBin = new TextEncoder().encode(payloadTxt);

  // prefer LiveKit
  try {
    const room: any = (window as any).__lkRoom;
    if (room && room.state === "connected" && room.localParticipant?.publishData) {
      await room.localParticipant.publishData(payloadBin, { reliable: true, topic: "chat" });
      return true;
    }
  } catch {}

  // fallback DC shim
  try {
    const dc: any = (window as any).__ditonaDataChannel;
    if (dc?.send) {
      dc.send(payloadTxt);
      return true;
    }
  } catch {}

  return false;
}

if (typeof window !== "undefined" && !window.__msgSendMounted2) {
  window.__msgSendMounted2 = 1;

  const onSend = async (e: Event) => {
    const detail = (e as CustomEvent).detail as SendDetail;
    const ok = await sendChat(detail?.text || "");
    if (ok) {
      try { window.dispatchEvent(new CustomEvent("ditona:chat:sent", { detail })); } catch {}
    }
  };

  window.addEventListener("ditona:chat:send", onSend as any);

  window.addEventListener("pagehide", () => {
    try { window.removeEventListener("ditona:chat:send", onSend as any); } catch {}
  }, { once: true });
}

export {};
