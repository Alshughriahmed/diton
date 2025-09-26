#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"
BK="_ops/backups/B3_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/rtcFlow.ts"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# إذا كان لدينا new RTCPeerConnection({ iceServers: X }) اجعلها reorderIceServers(X)
perl -0777 -pe 's/new\s+RTCPeerConnection\s*\(\s*\{\s*iceServers\s*:\s*([^\}]+)\}/new RTCPeerConnection({ iceServers: reorderIceServers(\1) })/g' -i "$F"

# علم وجود فحص أو ضمان الخادم الأول 443
TURNS_FIRST=$([ "$(grep -Ec 'reorderIceServers\(|hasTurns443First\(' "$F")" -ge 1 ] && echo 1 || echo 0)

echo "-- Acceptance --"
echo "TURNS_443_FIRST=$TURNS_FIRST"
echo "BACKUP_DIR=$BK"
