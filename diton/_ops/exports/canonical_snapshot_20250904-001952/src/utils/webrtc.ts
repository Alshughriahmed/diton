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