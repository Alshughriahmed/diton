"use client";

/** Full teardown for Next/Prev:
 * - close RTCPeerConnection and DataChannel
 * - abort fetch polls
 * - clear timers
 * - reset UI state (messages/like)
 * - stamp lastStopTs for ICE grace (client-provided hint)
 */
export function fullTeardown(opts: {
  pc?: RTCPeerConnection | null;
  dc?: RTCDataChannel | null;
  controllers?: AbortController[];
  timers?: any[];
  onReset?: () => void;
} = {}) {
  try { opts.pc?.getSenders?.().forEach(s => { try { s.replaceTrack?.(null as any); } catch {} }); } catch {}
  try { opts.dc && opts.dc.readyState !== "closed" && opts.dc.close(); } catch {}
  try { opts.pc?.close(); } catch {}

  try { opts.controllers?.forEach(c => { try { c.abort(); } catch {} }); } catch {}
  try { opts.timers?.forEach(t => { try { clearTimeout(t); clearInterval(t); } catch {} }); } catch {}

  try { localStorage.setItem("__lastStopTs", String(Date.now())); } catch {}
  try { opts.onReset?.(); } catch {}
}
