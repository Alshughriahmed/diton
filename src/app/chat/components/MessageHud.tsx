// src/app/chat/msgSendClient.ts
"use client";

/**
 * Chat sender over LiveKit Data (outbound only).
 * يعتمد حصراً على publishData ولا يستخدم DC-fallback.
 * - يستمع إلى 'ditona:chat:send' {text}
 * - ينتظر اتصال الغرفة ثم يرسل topic:'chat' وبهيكل {t:'chat', text, pairId}
 * - عند النجاح يطلق 'ditona:chat:sent' {text, pairId}
 */

declare global {
  interface Window {
    __msgSendMounted3?: 1;
    __lkRoom?: any;
    __ditonaPairId?: string;
    __pairId?: string;
  }
}

type SendDetail = { text: string; pairId?: string };

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

async function waitRoomConnected(ms = 1500): Promise<any | null> {
  const start = Date.now();
  // poll كل ~50ms حتى تتصل الغرفة
  while (Date.now() - start < ms) {
    const room = (window as any).__lkRoom;
    if (room && room.state === "connected" && room.localParticipant?.publishData) return room;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

async function sendChat(text: string, pairIdHint?: string): Promise<{ ok: boolean; pairId?: string }> {
  const trimmed = clamp2000(text);
  if (!trimmed) return { ok: false };

  const room = await waitRoomConnected();
  if (!room) return { ok: false };

  const pid = pairIdHint || readPairId();
  const payloadObj = { t: "chat", text: trimmed, pairId: pid };
  const payloadBin = new TextEncoder().encode(JSON.stringify(payloadObj));

  await room.localParticipant.publishData(payloadBin, { reliable: true, topic: TOPIC });
  return { ok: true, pairId: pid };
}

if (typeof window !== "undefined" && !window.__msgSendMounted3) {
  window.__msgSendMounted3 = 1;

  const onSend = async (e: Event) => {
    const detail = (e as CustomEvent).detail as SendDetail;
    try {
      const { ok, pairId } = await sendChat(detail?.text || "", detail?.pairId);
      if (ok) {
        window.dispatchEvent(new CustomEvent("ditona:chat:sent", { detail: { text: detail?.text || "", pairId } }));
      } else {
        // فشل الإرسال: لا نطلق sent حتى لا نعرض رسالة وهمية
        console.warn("[chat] send failed: room not connected");
      }
    } catch (err) {
      console.warn("[chat] send error:", err);
    }
  };

  window.addEventListener("ditona:chat:send", onSend as any);

  window.addEventListener(
    "pagehide",
    () => {
      try { window.removeEventListener("ditona:chat:send", onSend as any); } catch {}
    },
    { once: true }
  );
}

export {};
