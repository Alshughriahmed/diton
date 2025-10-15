// "use client";
import type { Room } from "livekit-client";
import { RoomEvent } from "livekit-client";

/** EventTarget-based shim that looks like a minimal DataChannel */
class DitonaDCShim extends EventTarget {
  /** connecting | open | closed */
  public readyState: "connecting" | "open" | "closed" = "connecting";
  public onmessage: ((ev: MessageEvent) => void) | null = null;

  private room: Room | null = null;
  private unsub: Array<() => void> = [];
  private queue: Uint8Array[] = [];

  /** attach current LiveKit room and start relaying data */
  attach(room: Room) {
    this.detach();
    this.room = room;

    const onData = (payload: Uint8Array) => {
      const msg = new MessageEvent("message", { data: new TextDecoder().decode(payload) });
      try { this.dispatchEvent(msg); } catch {}
      try { this.onmessage?.(msg); } catch {}
      // compatibility broadcast
      try {
        const txt = new TextDecoder().decode(payload || new Uint8Array());
        if (txt && /^\s*\{/.test(txt)) {
          const j = JSON.parse(txt);
          if (j?.t === "chat" && j.text) {
            window.dispatchEvent(new CustomEvent("ditona:chat:recv", { detail: { text: j.text } }));
          }
          if (j?.t === "peer-meta" && j.payload) {
            window.dispatchEvent(new CustomEvent("ditona:peer-meta", { detail: j.payload }));
          }
          if (j?.t === "like" || j?.type === "like:toggled") {
            window.dispatchEvent(new CustomEvent("rtc:peer-like", { detail: j }));
          }
        }
      } catch {}
    };
    const onDisc = () => {
      this.readyState = "closed";
      try { this.dispatchEvent(new Event("close")); } catch {}
    };

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Disconnected, onDisc);
    this.unsub.push(
      () => { try { room.off(RoomEvent.DataReceived, onData); } catch {} },
      () => { try { room.off(RoomEvent.Disconnected, onDisc); } catch {} },
    );

    // flush queued messages when attach completes
    const lp: any = room.localParticipant;
    while (this.queue.length) {
      const bytes = this.queue.shift()!;
      try { lp.publishData(bytes, { reliable: true }); } catch {}
    }

    // state
    this.readyState = room.state === "connected" ? "open" : "connecting";
  }

  /** drop listeners / detach from current room */
  detach() {
    for (const u of this.unsub.splice(0)) { try { u(); } catch {} }
    this.room = null;
    // keep readyState "connecting" until closed or re-attached
    if (this.readyState === "open") this.readyState = "connecting";
  }

  /** send (queued if not connected) */
  send(data: string | ArrayBuffer | Uint8Array) {
    const room = this.room;
    const lp: any = room?.localParticipant;
    const bytes =
      typeof data === "string"
        ? new TextEncoder().encode(data)
        : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);

    if (!room || room.state !== "connected") {
      this.readyState = "connecting";
      this.queue.push(bytes);
      return;
    }
    try {
      lp.publishData(bytes, { reliable: true });
      this.readyState = "open";
    } catch {
      this.queue.push(bytes);
      this.readyState = "connecting";
    }
  }

  /** close & drop any queued messages */
  close() {
    this.detach();
    this.queue = [];
    this.readyState = "closed";
  }
}

(function ensureSingleton(){
  if (typeof window === "undefined") return;
  const w = window as any;
  if (!w.__ditonaDataChannel) w.__ditonaDataChannel = new DitonaDCShim();
})();
export {};
