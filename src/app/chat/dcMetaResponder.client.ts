// src/app/chat/dcMetaResponder.client.ts
"use client";

import type { Room } from "livekit-client";
import { RoomEvent } from "livekit-client";

/**
 * DataChannel meta/like bridge.
 * - Listens to RoomEvent.DataReceived once per LiveKit room.
 * - Normalizes incoming payloads: meta, like:sync.
 * - Pair guard: drops events that don't match current pair.
 * - Emits:
 *   - "ditona:peer-meta"     detail = <flat meta object>        // legacy, flat
 *   - "rtc:peer-meta"        detail = { pairId, meta }           // structured
 *   - "like:sync"            detail = { pairId, count, liked }
 * - Triggers meta handshake on "lk:attached" and "rtc:pair".
 * - Can be forced to re-send local meta via "ditona:send-meta".
 */

declare global {
  interface Window {
    __lkRoom?: Room | null;
    __ditonaPairId?: string | null;
    __pairId?: string | null;

    __dc_meta_attached?: boolean;
    __dc_meta_handler__?: ((p: Uint8Array, topic?: string) => void) | null;
    __dc_meta_room__?: Room | null;

    __ditonaLocalMeta?: any;

    __dbg_on?: boolean;
  }
}

/* -------------------- utils -------------------- */

const td = new TextDecoder();
const te = new TextEncoder();

const log = (...a: any[]) => {
  if (window.__dbg_on) console.log("[DC]", ...a);
};

const nowPairId = (): string | null =>
  window.__ditonaPairId ?? window.__pairId ?? null;

const samePair = (pid?: string | null): boolean => {
  const cur = nowPairId();
  if (!cur) return true;
  if (!pid) return true;
  return pid === cur;
};

function sendJSON(room: Room | null | undefined, topic: string, obj: any) {
  try {
    if (!room?.localParticipant) return;
    room.localParticipant.publishData(te.encode(JSON.stringify(obj)), {
      reliable: true,
      topic,
    });
    log("sent", topic, obj);
  } catch (e) {
    console.warn("[DC] publishData failed:", e);
  }
}

const requestPeerMeta = (room: Room | null | undefined) => {
  sendJSON(room, "meta", { t: "meta:init", pairId: nowPairId() });
};

const resendLocalMeta = (room: Room | null | undefined) => {
  const meta =
    window.__ditonaLocalMeta ??
    (globalThis as any).__localMeta ??
    (globalThis as any).__meta ??
    null;
  if (!meta) return;
  sendJSON(room, "meta", { t: "meta", pairId: nowPairId(), meta });
};

/* ------------------ normalization ------------------ */

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

  if (obj.t === "meta" && obj.meta) {
    return { kind: "meta", pairId: pid, meta: obj.meta };
  }
  if (obj.meta && !obj.t) {
    return { kind: "meta", pairId: pid, meta: obj.meta };
  }
  if (obj.t === "peer-meta" && obj.payload) {
    return { kind: "meta", pairId: pid, meta: obj.payload };
  }

  if (obj.displayName || obj.gender || obj.country || obj.city) {
    return { kind: "meta", pairId: pid, meta: obj };
  }

  return { kind: "noop" };
}

/* ------------------ data handler ------------------ */

function makeDataHandler(room: Room) {
  const handler = (payload: Uint8Array, _topicOrP?: any, _k?: any, topic?: string) => {
    let text = "";
    try {
      text = td.decode(payload);
    } catch {
      return;
    }

    let obj: any;
    try {
      obj = JSON.parse(text);
    } catch {
      return;
    }

    // respond to meta:init regardless of pair guard
    if (obj?.t === "meta:init") {
      resendLocalMeta(room);
      return;
    }

    const n = normalizeMessage(obj);

    if (!samePair((n as any).pairId)) {
      log("drop pair mismatch", n);
      return;
    }

    if (n.kind === "meta") {
      const flat = n.meta;
      // legacy flat event used by peerMetaUi
      window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: flat }));
      // structured event for components that want pairId
      window.dispatchEvent(
        new CustomEvent("rtc:peer-meta", {
          detail: { pairId: n.pairId ?? nowPairId(), meta: flat },
        }),
      );
      log("[EV] ditona:peer-meta", flat);
      return;
    }

    if (n.kind === "like") {
      window.dispatchEvent(
        new CustomEvent("like:sync", {
          detail: { pairId: n.pairId ?? nowPairId(), count: n.count, liked: n.liked },
        }),
      );
      log("[EV] like:sync", { count: n.count, liked: n.liked });
      return;
    }

    // topics fallback: if producer sent via topic only
    if (topic === "meta") requestPeerMeta(room);
  };

  return handler;
}

/* ------------------ attach lifecycle ------------------ */

function attachToRoom(r?: Room | null) {
  if (!r) return;

  // prevent duplicate attachment to the same Room
  if (window.__dc_meta_room__ === r && typeof window.__dc_meta_handler__ === "function") {
    return;
  }

  // detach previous
  if (window.__dc_meta_room__ && window.__dc_meta_handler__) {
    try {
      window.__dc_meta_room__.off(
        RoomEvent.DataReceived,
        window.__dc_meta_handler__ as any,
      );
    } catch {}
  }

  const h = makeDataHandler(r);
  r.on(RoomEvent.DataReceived, h as any);

  window.__dc_meta_handler__ = h;
  window.__dc_meta_room__ = r;
  window.__dc_meta_attached = true;

  log("DataReceived attached");

  // kick off handshake
  requestPeerMeta(r);
  resendLocalMeta(r);
}

/* ------------------ init ------------------ */

function initOnce() {
  // immediate attach if room is present
  if (window.__lkRoom) attachToRoom(window.__lkRoom);

  // on LiveKit attach
  window.addEventListener("lk:attached", () => {
    attachToRoom(window.__lkRoom);
    requestPeerMeta(window.__lkRoom);
    resendLocalMeta(window.__lkRoom);
  });

  // new pair → refresh meta exchange
  window.addEventListener("rtc:pair", () => {
    requestPeerMeta(window.__lkRoom);
    resendLocalMeta(window.__lkRoom);
  });

  // manual re-send
  window.addEventListener("ditona:send-meta", () => {
    resendLocalMeta(window.__lkRoom);
  });
}

initOnce();
