// src/app/chat/likeSyncClient.ts
/**
 * يستقبل رسائل الإعجاب عبر قناة البيانات ويحوّلها لأحداث UI.
 * كما يوفّر likeApiThenDc() للتوافق مع LikeSystem.tsx.
 */

declare global {
  interface Window {
    __likeSyncMounted?: 1;
    __ditonaDataChannel?: {
      addEventListener?: (type: "message", handler: (ev: MessageEvent) => void) => void;
      removeEventListener?: (type: "message", handler: (ev: MessageEvent) => void) => void;
      setSendGuard?: (fn: () => boolean) => void;
    };
    __lkRoom?: {
      state?: string;
      localParticipant?: {
        publishData?: (payload: Uint8Array, opts?: { reliable?: boolean; topic?: string }) => Promise<void> | void;
      };
    } | null;
  }
}

function safeParseLike(ev: MessageEvent) {
  const data = ev?.data;
  if (!data) return null;
  let txt: string | null = null;
  if (typeof data === "string") txt = data;
  else if (data instanceof ArrayBuffer) txt = new TextDecoder().decode(new Uint8Array(data));
  else if (ArrayBuffer.isView(data)) txt = new TextDecoder().decode(data as any);
  if (!txt || !/^\s*\{/.test(txt)) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function emitLike(liked: boolean) {
  try {
    // حدث قديم للتوافق
    window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: { liked } }));
    // حدث جديد عام
    window.dispatchEvent(new CustomEvent("ditona:like:recv", { detail: { liked } }));
  } catch {}
}

/** API توافقية يُنادى بها من LikeSystem.tsx */
export async function likeApiThenDc(liked: boolean): Promise<{ ok: boolean }> {
  try {
    const room = window.__lkRoom;
    if (!room || room.state !== "connected") return { ok: false };
    const payload = new TextEncoder().encode(JSON.stringify({ t: "like", liked }));
    await room.localParticipant?.publishData?.(payload, { reliable: true, topic: "like" });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

if (typeof window !== "undefined" && !window.__likeSyncMounted) {
  window.__likeSyncMounted = 1;

  const onDCMessage = (ev: MessageEvent) => {
    const j = safeParseLike(ev);
    if (!j) return;
    // صيغ مدعومة:
    // { t: "like", liked: true }
    // { type: "like:toggled", payload: { liked: true } }
    if (j?.t === "like" && typeof j.liked === "boolean") {
      emitLike(!!j.liked);
    } else if (j?.type === "like:toggled" && j?.payload && typeof j.payload.liked === "boolean") {
      emitLike(!!j.payload.liked);
    }
  };

  try {
    const dc = window.__ditonaDataChannel;
    if (dc?.addEventListener) dc.addEventListener("message", onDCMessage);
    if (dc?.setSendGuard) {
      dc.setSendGuard(() => {
        const room = window.__lkRoom;
        return !!room && room.state === "connected";
      });
    }
  } catch {}
}
