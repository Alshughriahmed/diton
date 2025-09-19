#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/C3_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/components/ChatMessagingBar.tsx"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# z-[70] بدل z-70
perl -0777 -pe 's/\bz-70\b/z-[70]/g' -i "$F"

echo "-- Acceptance --"
echo "MSG_BAR_Z_OK=$([ "$(grep -c 'z-\[70\]' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "VISUAL_VIEWPORT_OK=$([ "$(grep -ci 'visualViewport' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
