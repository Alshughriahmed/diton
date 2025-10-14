"use client";
import type { Room } from "livekit-client";
import { RoomEvent } from "livekit-client";

/** EventTarget-based data-channel shim */
class DitonaDCShim extends EventTarget {
  readyState: "connecting" | "open" | "closed" = "connecting";
  onmessage: ((ev: MessageEvent) => void) | null = null;

  private room: Room | null = null;
  private unsub: Array<() => void> = [];
  private queue: Uint8Array[] = [];

  attach(room: Room) {
    this.detach();
    this.room = room;
    this.readyState = "open";

    const onData = (payload: Uint8Array) => {
      let data: any = payload;
      try {
        const text = new TextDecoder().decode(payload);
        if (text && /^\s*[\{\[]/.test(text)) data = text; // مرّر النص فقط إن كان JSON
      } catch {}
      const ev = new MessageEvent("message", { data });
      this.dispatchEvent(ev);
      try { this.onmessage?.(ev); } catch {}
    };
    const onDisc = () => this.close();

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Disconnected, onDisc);
    this.unsub.push(
      () => { try { room.off(RoomEvent.DataReceived, onData); } catch {} },
      () => { try { room.off(RoomEvent.Disconnected, onDisc); } catch {} },
    );

    // flush any queued messages
    const lp: any = room.localParticipant;
    while (this.queue.length) {
      const bytes = this.queue.shift()!;
      try { lp.publishData(bytes, { reliable: true }); } catch {}
    }
  }

  send(data: string | Uint8Array | ArrayBuffer) {
    const bytes =
      typeof data === "string" ? new TextEncoder().encode(data)
      : data instanceof Uint8Array ? data
      : new Uint8Array(data as ArrayBuffer);

    const r = this.room;
    if (!r || this.readyState !== "open") { this.queue.push(bytes); return; }
    try { (r.localParticipant as any).publishData(bytes, { reliable: true }); }
    catch { this.queue.push(bytes); }
  }

  close() { this.detach(); this.readyState = "closed"; }

  private detach() {
    for (const f of this.unsub) try { f(); } catch {}
    this.unsub = [];
    this.room = null;
  }
}

(function boot(){
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__ditonaDataChannel && typeof w.__ditonaDataChannel.addEventListener === "function") return;
  w.__ditonaDataChannel = new DitonaDCShim();
})();
export {};
