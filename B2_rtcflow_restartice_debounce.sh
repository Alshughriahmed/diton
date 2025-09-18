#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"
BK="_ops/backups/B2_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/rtcFlow.ts"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# أضف الدالة إن غابت
grep -q 'function scheduleRestartIce' "$F" || cat >> "$F" <<'TS'
/** Debounced ICE restart on transient drops (1000–1200ms) */
let __iceRestartTimer: any = null;
async function __doRestartIce() {
  if (!state?.pc || state?.ac?.signal?.aborted) return;
  try {
    if (typeof state.pc.restartIce === 'function') {
      state.pc.restartIce();
    } else {
      const offer = await state.pc.createOffer({ iceRestart: true });
      await state.pc.setLocalDescription(offer);
    }
  } catch (e) { try { if (e?.name!=='AbortError') console.warn('restartIce fail', e); } catch {} }
}
function scheduleRestartIce(delay:number=1100) {
  try {
    if (__iceRestartTimer) return;
    __iceRestartTimer = setTimeout(() => { __iceRestartTimer = null; __doRestartIce(); }, delay);
  } catch {}
}
TS

# اربطها في onconnectionstatechange إذا غابت
grep -q 'scheduleRestartIce()' "$F" || awk '
/onconnectionstatechange\s*=\s*\(\)\s*=>\s*\{/ && !p {
  print;
  print "    try{ const st=(state.pc as any).connectionState; if(st===\"disconnected\"||st===\"failed\"){ scheduleRestartIce(1100); } }catch{}";
  p=1; next
}
{ print }' "$F" > "$F.tmp" && mv "$F.tmp" "$F"

echo "-- Acceptance --"
echo "ICE_RESTART_DEBOUNCED=$([ "$(grep -c 'scheduleRestartIce' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "HOOKED_CONNSTATE=$([ "$(grep -c 'connectionstatechange' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
