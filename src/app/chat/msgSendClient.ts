"use client";

/**
 * Chat sender over LiveKit Data (outbound only).
 * - Listens to 'ditona:chat:send' {text}
 * - Sends via room.localParticipant.publishData(topic:'chat') or DC shim fallback.
 * - Emits 'ditona:chat:sent' on success.
 * Receiving path stays in ChatClient(RoomEvent.DataReceived) to avoid duplicates.
 */

declare global {
  interface Window {
    __msgSendMounted2?: 1;
    __lkRoom?: any;
    __ditonaDataChannel?: { send?: (s: string) => void };
    __ditonaPairId?: string;
    __pairId?: string;
  }
}

type SendDetail = { text: string };

const TOPIC = "chat";

function clamp2000(s: string) {
  const t = (s || "").trim();
  return t.length > 2000 ? t.slice(0, 2000) : t;
}

function readPairId(): string | undefined {
  try {
    const w = window as any;
    if (w.__ditonaPairId) return String(w.__ditonaPairId);
    if (w.__pairId) return String(w.__pairId);
    const rn = w.__lkRoom?.name;
    if (typeof rn === "string" && rn.startsWith("pair-")) return rn;
  } catch {}
  return undefined;
}

async function sendChat(text: string): Promise<boolean> {
  const trimmed = clamp2000(text);
  if (!trimmed) return false;

  const payloadObj = { t: "chat", text: trimmed, pairId: readPairId() };
  const payloadTxt = JSON.stringify(payloadObj);
  const payloadBin = new TextEncoder().encode(payloadTxt);

  // prefer LiveKit
  try {
    const room = (window as any).__lkRoom;
    if (room && room.state === "connected" && room.localParticipant?.publishData) {
      await room.localParticipant.publishData(payloadBin, { reliable: true, topic: TOPIC });
      return true;
    }
  } catch {}

  // fallback DC shim
  try {
    const dc = (window as any).__ditonaDataChannel;
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
      try {
        window.dispatchEvent(new CustomEvent("ditona:chat:sent", { detail }));
      } catch {}
    }
  };

  window.addEventListener("ditona:chat:send", onSend as any);

  window.addEventListener(
    "pagehide",
    () => {
      try {
        window.removeEventListener("ditona:chat:send", onSend as any);
      } catch {}
    },
    { once: true }
  );
}

export {};
