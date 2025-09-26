#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"
BK="_ops/backups/B4_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/ChatClient.tsx"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# "use client" في السطر الأول
head -n1 "$F" | grep -q '"use client"' || sed -i '1i "use client";' "$F"

# تأكيد استخدام startRtcFlowOnce ومنع التدفقات المكررة (فقط تحقّق وجود الاسم)
START_GUARD=$([ "$(grep -c 'startRtcFlowOnce' "$F")" -ge 1 ] && echo 1 || echo 0)

echo "-- Acceptance --"
echo "USE_CLIENT_TOP=$([ "$(head -n1 "$F" | grep -c '"use client"')" -eq 1 ] && echo 1 || echo 0)"
echo "START_GUARD_PRESENT=$START_GUARD"
echo "BACKUP_DIR=$BK"
