import type { Room } from "livekit-client";
interface DitonaDC extends EventTarget {
  readyState: "connecting" | "open" | "closed";
  onmessage: ((ev: MessageEvent)=>void) | null;
  send(data: string | Uint8Array | ArrayBuffer): void;
  close(): void;
  attach?: (room: Room) => void;
}
declare global {
  interface Window { __ditonaDataChannel?: DitonaDC; }
}
export {};
