#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/B4_fix_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/ChatClient.tsx"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# تأكيد "use client" أول سطر
head -n1 "$F" | grep -q '"use client"' || sed -i '1i "use client";' "$F"

# إن كانت الاستدعاءات تستخدم startRtcFlow(...) فحوّلها إلى startRtcFlowOnce(...)
if grep -q 'startRtcFlowOnce' "$F"; then
  perl -0777 -pe 's/\bstartRtcFlow\s*\(/startRtcFlowOnce(/g' -i "$F"
fi

echo "-- Acceptance --"
echo "USE_CLIENT_TOP=$([ "$(head -n1 "$F" | grep -c '"use client"')" -eq 1 ] && echo 1 || echo 0)"
echo "START_GUARD_PRESENT=$([ "$(grep -c 'startRtcFlowOnce' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
