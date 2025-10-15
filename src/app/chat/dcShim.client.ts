// src/app/chat/dcShim.client.ts
/**
 * Ditona DataChannel Shim — v2
 * EventTarget متوافق + طابور إرسال + ربط بعد connect فقط.
 * يضمن أن المستهلكين يعملون على event.data وأنه لا إرسال قبل الاتصال.
 */

declare global {
  interface Window {
    __ditonaDataChannel?: any;
  }
}

if (typeof window !== "undefined") {
  const w = window as any;

  // لا تعرّف مرتين
  if (!w.__ditonaDataChannel || w.__ditonaDataChannel.__shimVersion !== "v2") {
    type Listener = (ev: MessageEvent) => void;

    class DCShim {
      __shimVersion = "v2";

      private listeners = new Set<Listener>();
      private sendGuard: (() => boolean) | null = null;

      private room: any = null;
      private connected = false;
      private bound = false;

      private sendQueue: Array<string | ArrayBufferView | ArrayBuffer> = [];

      /* ===== EventTarget API ===== */
      addEventListener(type: "message", handler: Listener) {
        if (type !== "message" || typeof handler !== "function") return;
        this.listeners.add(handler);
      }
      removeEventListener(type: "message", handler: Listener) {
        if (type !== "message" || typeof handler !== "function") return;
        this.listeners.delete(handler);
      }
      private dispatchMessage(data: any) {
        const ev = new MessageEvent("message", { data });
        for (const h of Array.from(this.listeners)) {
          try {
            h(ev);
          } catch {}
        }
      }

      /* ===== Guards ===== */
      setSendGuard(fn: () => boolean) {
        this.sendGuard = typeof fn === "function" ? fn : null;
      }
      private canSend() {
        if (!this.connected || !this.room?.localParticipant?.publishData) return false;
        if (this.sendGuard && !this.sendGuard()) return false;
        return true;
      }

      /* ===== Attach / Detach ===== */
      attach(room: any) {
        if (!room || this.room === room) return;
        this.detach();
        this.room = room;
        this.connected = room?.state === "connected";

        // ربط مستمعي LiveKit
        try {
          const DataReceived = (room as any).events?.DataReceived ?? "dataReceived";
          const Disconnected = (room as any).events?.Disconnected ?? "disconnected";
          // واجهة livekit-client الفعلية:
          room.on?.(DataReceived, this.onData);
          room.on?.("dataReceived", this.onData);
          room.on?.("Disconnected", this.onDisconnected);
          room.on?.("disconnected", this.onDisconnected);
          this.bound = true;
        } catch {
          this.bound = false;
        }

        // إذا كان متصلًا، افرغ الطابور
        this.flushQueue();
      }

      detach() {
        if (!this.room) return;
        try {
          const r = this.room;
          r.off?.("dataReceived", this.onData);
          r.off?.("DataReceived", this.onData);
          r.off?.("Disconnected", this.onDisconnected);
          r.off?.("disconnected", this.onDisconnected);
        } catch {}
        this.room = null;
        this.connected = false;
        this.bound = false;
        // لا نمسح الطابور: سيُرسل عند attach القادم بعد connect
      }

      /* ===== Send / Flush ===== */
      send(data: string | ArrayBufferView | ArrayBuffer) {
        if (!this.canSend()) {
          this.sendQueue.push(data);
          return false;
        }
        try {
          const bin = this.toUint8(data);
          this.room.localParticipant.publishData(bin, { reliable: true });
          return true;
        } catch {
          this.sendQueue.push(data);
          return false;
        }
      }

      private flushQueue() {
        if (!this.canSend() || this.sendQueue.length === 0) return;
        const q = this.sendQueue.splice(0);
        for (const item of q) {
          try {
            const bin = this.toUint8(item);
            this.room.localParticipant.publishData(bin, { reliable: true });
          } catch {
            // إعادة إلى الطابور إذا فشل
            this.sendQueue.push(item);
          }
        }
      }

      /* ===== LiveKit event handlers ===== */
      private onData = (payload: Uint8Array | ArrayBuffer) => {
        try {
          // مرّر كما هو. المستهلكون يدعمون نص/باينري
          const ab = payload instanceof Uint8Array ? payload : new Uint8Array(payload as ArrayBuffer);
          this.dispatchMessage(ab);
        } catch {}
      };

      private onDisconnected = () => {
        this.connected = false;
      };

      /* ===== Helpers ===== */
      private toUint8(data: string | ArrayBufferView | ArrayBuffer): Uint8Array {
        if (typeof data === "string") return new TextEncoder().encode(data);
        if (data instanceof ArrayBuffer) return new Uint8Array(data);
        if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        // fallback
        const s = String(data ?? "");
        return new TextEncoder().encode(s);
      }

      /* ===== Public hooks from ChatClient ===== */
      setConnected(v: boolean) {
        this.connected = !!v;
        if (this.connected) this.flushQueue();
      }
    }

    w.__ditonaDataChannel = new DCShim();
  }
}

export {};
