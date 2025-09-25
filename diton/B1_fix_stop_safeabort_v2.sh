#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/B1_fix_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/rtcFlow.ts"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# 1) أي استدعاء مباشر لـ abort()
perl -0777 -pe 's/\bstate\.ac\s*\?\.\s*abort\s*\(\s*\)\s*;?/safeAbort(state.ac); state.ac = null;/g' -i "$F"
perl -0777 -pe 's/\bstate\.ac\.abort\s*\(\s*\)\s*;?/safeAbort(state.ac); state.ac = null;/g' -i "$F"

# 2) داخل دالة stop(): إن وجِد safeAbort بدون null فأضِف state.ac=null بعده
perl -0777 -pe '
  s/(function\s+stop\s*\([^)]*\)\s*\{[^}]*?safeAbort\(state\.ac\);\s*)(?!\s*state\.ac\s*=\s*null;)/$1 state.ac = null;/s
' -i "$F"

echo "-- Acceptance --"
echo "RTC_STOP_SAFEABORT=$([ "$(grep -c 'safeAbort(state.ac); state.ac = null;' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
