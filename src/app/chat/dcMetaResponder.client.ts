// src/app/chat/dcMetaResponder.client.ts
"use client";

import type { Room } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { normalizeGender } from "@/lib/gender";

declare global {
  interface Window {
    __lkRoom?: Room | null;
    __ditonaPairId?: string | null;
    __pairId?: string | null;

    __dc_meta_handler__?: ((p: Uint8Array, topic?: string) => void) | null;
    __dc_meta_room__?: Room | null;
    __dc_meta_attached?: boolean;

    __ditonaLocalMeta?: any;
    __dbg_on?: boolean;
  }
}

const td = new TextDecoder();
const te = new TextEncoder();
const log = (...a: any[]) => { if (window.__dbg_on) console.log("[DC]", ...a); };

const nowPairId = (): string | null => window.__ditonaPairId ?? window.__pairId ?? null;
const samePair = (pid?: string | null): boolean => {
  const cur = nowPairId();
  if (!cur) return true;
  if (!pid) return true;
  return pid === cur;
};

function toISO2(v?: unknown): string | undefined {
  const s = String(v ?? "").trim();
  return s.length === 2 ? s.toUpperCase() : (s || undefined);
}

function canonicalizeMeta(raw: any): any {
  const obj = raw || {};
  return {
    displayName: typeof obj.displayName === "string" ? obj.displayName : "",
    gender: normalizeGender(obj.gender as any),                // "m"|"f"|"c"|"l"|"u"
    country: toISO2(obj.country || obj.countryCode || obj.cc),
    city: typeof obj.city === "string" ? obj.city : undefined,
    likes: typeof obj.likes === "number" ? obj.likes : undefined,
    vip: !!obj.vip,
    avatarUrl: typeof obj.avatarUrl === "string" ? obj.avatarUrl : undefined,
    did: obj.did || obj.deviceId || obj.peerDid || obj.id || obj.identity,
  };
}

type Normalized =
  | { kind: "meta"; pairId: string | null; meta: any }
  | { kind: "like"; pairId: string | null; count: number; liked: boolean }
  | { kind: "noop" };

function normalizeMessage(obj: any): Normalized {
  if (!obj || typeof obj !== "object") return { kind: "noop" };
  const pid = obj.pairId ?? null;

  if (obj.t === "like:sync") {
    const liked = typeof obj.liked === "boolean" ? obj.liked : !!obj.you;
    const count = typeof obj.count === "number" ? obj.count : 0;
    return { kind: "like", pairId: pid, count, liked };
  }
  if (obj.t === "meta:init") return { kind: "noop" };

  if (obj.t === "meta" && obj.meta) return { kind: "meta", pairId: pid, meta: obj.meta };
  if (obj.meta && !obj.t)          return { kind: "meta", pairId: pid, meta: obj.meta };
  if (obj.t === "peer-meta" && obj.payload) return { kind: "meta", pairId: pid, meta: obj.payload };
  if (obj.displayName || obj.gender || obj.country || obj.city) return { kind: "meta", pairId: pid, meta: obj };
  return { kind: "noop" };
}

function sendJSON(room: Room | null | undefined, topic: string, obj: any) {
  try {
    if (!room?.localParticipant) return;
    room.localParticipant.publishData(te.encode(JSON.stringify(obj)), { reliable: true, topic });
    log("sent", topic, obj);
  } catch (e) { console.warn("[DC] publishData failed:", e); }
}

const requestPeerMeta = (room: Room | null | undefined) => {
  sendJSON(room, "meta", { t: "meta:init", pairId: nowPairId() });
};
const resendLocalMeta = (room: Room | null | undefined) => {
  const meta =
    window.__ditonaLocalMeta ??
    (globalThis as any).__localMeta ??
    (globalThis as any).__meta ?? null;
  if (!meta) return;
  sendJSON(room, "meta", { t: "meta", pairId: nowPairId(), meta });
};

function makeDataHandler(room: Room) {
  const handler = (payload: Uint8Array, _topicOrP?: any, _k?: any, topic?: string) => {
    let text = ""; try { text = td.decode(payload); } catch { return; }
    if (!/^\s*\{/.test(text)) return;

    let obj: any; try { obj = JSON.parse(text); } catch { return; }

    // meta:init → أعد بث الميتا المحلية
    if (obj?.t === "meta:init") { resendLocalMeta(room); return; }

    const n = normalizeMessage(obj);
    if (!samePair((n as any).pairId)) { log("drop pair mismatch", n); return; }

    if (n.kind === "meta") {
      const flat = canonicalizeMeta(n.meta);
      const pid = n.pairId ?? nowPairId();
      // قديم (مسطح)
      window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: { pairId: pid, meta: flat } }));
      // منظّم
      window.dispatchEvent(new CustomEvent("rtc:peer-meta", { detail: { pairId: pid, meta: flat } }));
      log("[EV] peer-meta", flat);
      return;
    }

    if (n.kind === "like") {
      const pid = n.pairId ?? nowPairId();
      window.dispatchEvent(new CustomEvent("like:sync", { detail: { pairId: pid, count: n.count, liked: n.liked } }));
      log("[EV] like:sync", { count: n.count, liked: n.liked });
      return;
    }

    // fallback
    if (topic === "meta") requestPeerMeta(room);
  };
  return handler;
}

function attachToRoom(r?: Room | null) {
  if (!r) return;
  // انزع القديم
  if (window.__dc_meta_room__ && window.__dc_meta_handler__) {
    try { window.__dc_meta_room__!.off(RoomEvent.DataReceived, window.__dc_meta_handler__ as any); } catch {}
  }
  const h = makeDataHandler(r);
  r.on(RoomEvent.DataReceived, h as any);
  window.__dc_meta_handler__ = h;
  window.__dc_meta_room__ = r;
  window.__dc_meta_attached = true;

  log("DataReceived attached");
  requestPeerMeta(r);
  resendLocalMeta(r);
}

(function initOnce() {
  if (window.__lkRoom) attachToRoom(window.__lkRoom);
  window.addEventListener("lk:attached", () => { attachToRoom(window.__lkRoom); requestPeerMeta(window.__lkRoom); resendLocalMeta(window.__lkRoom); });
  window.addEventListener("rtc:pair", () => { requestPeerMeta(window.__lkRoom); resendLocalMeta(window.__lkRoom); });
  window.addEventListener("ditona:send-meta", () => { resendLocalMeta(window.__lkRoom); });
})();
