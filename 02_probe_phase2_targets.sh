
#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
OUT="_ops/reports/phase2_probe_$(date -u +%Y%m%d-%H%M%S).log"
mkdir -p _ops/reports

p(){ echo -e "\n=== $1 ===" | tee -a "$OUT"; }
s(){ [ -f "$1" ] && echo "$1" || echo "MISSING:$1"; }

# 1) rtcFlow.ts
F1="src/app/chat/rtcFlow.ts"
p "rtcFlow.ts: path $(s "$F1")" ; [ -f "$F1" ] && {
  grep -n "function stop" -n "$F1"      | tee -a "$OUT" || true
  awk '/function stop\(/,/^\}/ {print NR": "$0}' "$F1" | sed -n '1,200p' | tee -a "$OUT"
  p "rtcFlow.ts: abort calls"
  grep -n "state\.ac\.abort" "$F1"      | tee -a "$OUT" || true
  p "rtcFlow.ts: restartIce occurrences"
  grep -n "restartIce" "$F1"            | tee -a "$OUT" || true
  p "rtcFlow.ts: connectionstate handlers"
  grep -nE "connectionstate|iceconnectionstate" "$F1" | tee -a "$OUT" || true
}

# 2) ChatClient.tsx
F2="src/app/chat/ChatClient.tsx"
p "ChatClient.tsx: path $(s "$F2")" ; [ -f "$F2" ] && {
  p "start/stop usage"
  grep -nE "startRtcFlowOnce|stopRtcSession|on(Next|Prev|Cancel)" "$F2" | tee -a "$OUT" || true
  p "video.srcObject and localStream references"
  grep -nE "srcObject|localStream" "$F2" | tee -a "$OUT" || true
  nl -ba "$F2" | sed -n '1,240p' | tee -a "$OUT"
}

# 3) ICE servers preference
p "ICE servers (grep urls)"
grep -RniE "iceServers|turn|stun|urls" src/app/chat src/app --include='*.ts*' 2>/dev/null | tee -a "$OUT" || true

# 4) mm.ts: prev/last + TTLs
F3="src/lib/rtc/mm.ts"
p "mm.ts: path $(s "$F3")" ; [ -f "$F3" ] && {
  p "prev-wish / prev-for blocks"
  grep -nE "prev-wish|prev-for" "$F3" | tee -a "$OUT" || true
  p "SETNX/claim/pairLock"
  grep -nE "setNx|SETNX|claim|pairLock" "$F3" | tee -a "$OUT" || true
  p "writes to rtc:last"
  grep -nE "rtc:last" "$F3" | tee -a "$OUT" || true
  p "TTL constants (ms)"
  grep -nE "TTL|PX|expire|setPx" "$F3" | tee -a "$OUT" || true
  nl -ba "$F3" | sed -n '1,220p' | tee -a "$OUT"
}

# 5) matchmake route quick view
F4="src/app/api/rtc/matchmake/route.ts"
p "matchmake route.ts: path $(s "$F4")" ; [ -f "$F4" ] && {
  p "dynamic/runtime + response shape"
  grep -nE 'export const (dynamic|runtime)|peerAnonId|found' "$F4" | tee -a "$OUT" || true
  nl -ba "$F4" | sed -n '1,160p' | tee -a "$OUT"
}

echo "-- Acceptance --" | tee -a "$OUT"
echo "PROBE_OK=1" | tee -a "$OUT"
echo "REPORT=$OUT"
