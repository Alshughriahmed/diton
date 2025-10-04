/**
 * Structured log with sampling. Server-only.
 * LOG_SAMPLING ∈ [0..1], defaults 0.0 (off).
 */
export function logRTC(event: Record<string, unknown>) {
  const s = Number(process.env.LOG_SAMPLING ?? "0");
  if (!(s > 0) || Math.random() > s) return;
  try {
    // Keep it flat and small
    // Common fields: route, reqId, pairId, anonId, role, phase, op, ms
    console.log(JSON.stringify({ t: Date.now(), ...event }));
  } catch {}
}
