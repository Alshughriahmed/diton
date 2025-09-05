/* ui-bridge listeners (auto-wired) */
if (typeof window !== "undefined") {
  // @ts-ignore - busEmit may be in scope in this module
  // Next
  window.addEventListener("ui:next", (e:any)=>{
    try { /* @ts-ignore */ if (typeof busEmit === "function") busEmit('next', e?.detail || {}); } catch {}
  });
  // Prev
  window.addEventListener("ui:prev", (e:any)=>{
    try { /* @ts-ignore */ if (typeof busEmit === "function") busEmit('prev', e?.detail || {}); } catch {}
  });
}

// DitonaChat: WebRTC auto-next functionality
import { busEmit } from './bus';

let lastNextTime = 0;
const DEBOUNCE_INTERVAL = 1000;

const fire = (why: string) => {
  const now = Date.now();
  if (now - lastNextTime < DEBOUNCE_INTERVAL) return;
  lastNextTime = now;
  busEmit('next', { reason: why });
};

export function handlePeerConnectionFailure() {
  fire('connection_failed');
}

export function handleDisconnection() {
  fire('disconnected');
}

export function handleHangup() {
  busEmit('next', { reason: 'hangup' });
}