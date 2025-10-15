declare global {
  interface Window {
    __ditonaDataChannel?: {
      readyState: "connecting" | "open" | "closed";
      attach: (room: any) => void;
      detach: () => void;
      send: (data: string | ArrayBuffer | Uint8Array) => void;
      close: () => void;
      onmessage: null | ((ev: MessageEvent) => void);
      addEventListener: (t: string, cb: EventListenerOrEventListenerObject) => void;
      removeEventListener: (t: string, cb: EventListenerOrEventListenerObject) => void;
      dispatchEvent: (ev: Event) => boolean;
    };
    __lkRoom?: any;
  }
}
export {};
