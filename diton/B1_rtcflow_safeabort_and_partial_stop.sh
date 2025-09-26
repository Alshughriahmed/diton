#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"
BK="_ops/backups/B1_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/rtcFlow.ts"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# 1) استبدال أي state.ac.abort() بـ safeAbort(state.ac); state.ac=null;
perl -0777 -pe 's/\bstate\.ac\.abort\s*\(\s*\)\s*;?/safeAbort(state.ac); state.ac = null;/g' -i "$F"

# 2) عدم إيقاف مسارات localStream في stop(): علّق أي stop() على local
perl -0777 -pe 's/^(\s*\/\/?\s*)(.*local\S*\.get(Video|Audio)Tracks\(\)\.forEach\([^)]+stop\(\)\)\s*;)/$1\/\/ KEEP-LOCAL: $2/gm' -i "$F"

# 3) عدم تفريغ معاينة الفيديو: علّق أي video.srcObject = null
perl -0777 -pe 's/^(\s*)([^\/\n]*\.srcObject\s*=\s*null\s*;)/$1\/\/ KEEP-LOCAL: $2/gm' -i "$F"

echo "-- Acceptance --"
echo "RTC_STOP_SAFEABORT=$([ "$(grep -c 'safeAbort(state.ac); state.ac = null;' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "KEEP_LOCAL_TRACKS=$([ "$(grep -c 'KEEP-LOCAL' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
