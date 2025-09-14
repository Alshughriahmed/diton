// Lightweight client-only metrics beacons
export type RtcMetrics = {
  ts: number;
  sessionId: string;
  pairId?: string;
  role?: 'caller'|'callee';
  matchMs?: number;
  ttfmMs?: number;
  reconnectMs?: number;
  iceOk?: boolean;
  iceTries?: number;
  turns443?: boolean;
};

export function sendRtcMetrics(m: RtcMetrics) {
  const payload = JSON.stringify(m);
  const url = '/api/monitoring/metrics';
  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([payload], { type: 'application/json' });
      (navigator as any).sendBeacon(url, blob);
      return;
    }
  } catch {}
  // Fallback
  try {
    fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: payload });
  } catch {}
}