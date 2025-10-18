"use client";

// Reliable chat sending over LiveKit DataChannel
const CHAT_TOPIC = "chat";

function readPairId(): string | null {
  try {
    const pid = (window as any).__ditonaPairId || (window as any).__pairId || null;
    return typeof pid === "string" && pid ? pid : null;
  } catch {
    return null;
  }
}
function clamp2000(s: string) {
  return s.length > 2000 ? s.slice(0, 2000) : s;
}

export async function sendChatText(text: string) {
  const room: any = (globalThis as any).__lkRoom;
  const pairId = readPairId();
  const cleaned = clamp2000(String(text ?? "").trim());
  if (!room || !cleaned || !pairId) return;

  const payload = { t: "chat", text: cleaned, pairId, ts: Date.now() };

  try {
    const bin = new TextEncoder().encode(JSON.stringify(payload));
    await room.localParticipant.publishData(bin, { reliable: true, topic: CHAT_TOPIC });
    window.dispatchEvent(new CustomEvent("ditona:chat:sent", { detail: payload }));
  } catch (e) {
    console.warn("[chat] publishData failed, trying dcShim", e);
    try {
      (window as any).dcShimSend?.("chat", payload);
      window.dispatchEvent(new CustomEvent("ditona:chat:sent", { detail: payload }));
    } catch {}
  }
}

// UI bridge: شريط الرسائل وأي مكون آخر يطلق هذا الحدث للإرسال
try {
  window.addEventListener("ditona:chat:send", (ev: any) => {
    const txt = ev?.detail?.text ?? "";
    sendChatText(txt);
  });
} catch {}
