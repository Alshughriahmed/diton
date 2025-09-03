import { busEmit } from "./bus";

/** Bind minimal auto-next semantics to a RTCPeerConnection-like object */
export function bindAutoNext(pc: RTCPeerConnection) {
  const fire = (why: string) => busEmit('next', { reason: why });
  const onState = () => {
    const s: any = (pc as any).connectionState || (pc as any).iceConnectionState;
    if (s === 'failed' || s === 'disconnected' || s === 'closed') fire(String(s));
  };
  try { (pc as any).addEventListener?.('connectionstatechange', onState as any); } catch {}
  try { (pc as any).addEventListener?.('iceconnectionstatechange', onState as any); } catch {}
}

/** Call when user presses Hangup */
export function emitHangup() {
  busEmit('next', { reason: 'hangup' });
}
