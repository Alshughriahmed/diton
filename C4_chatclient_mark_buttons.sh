#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/C4_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/ChatClient.tsx"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# حقن data-ui="btn-next" للعناصر ذات onClick مرتبطة بـ onNext/handleNext/goNext
perl -0777 -i -pe '
  s/<([A-Za-z][\w]*)\s+([^>]*onClick=\{[^}]*?(onNext|handleNext|goNext)[^}]*\}[^>]*)>/"<".$1." data-ui=\"btn-next\" ". $2.">"/ge;
' "$F" || true

# حقن data-ui="btn-prev" للعناصر ذات onClick مرتبطة بـ onPrev/handlePrev/goPrev
perl -0777 -i -pe '
  s/<([A-Za-z][\w]*)\s+([^>]*onClick=\{[^}]*?(onPrev|handlePrev|goPrev)[^}]*\}[^>]*)>/"<".$1." data-ui=\"btn-prev\" ". $2.">"/ge;
' "$F" || true

NEXT_OK=$([ "$(grep -c 'data-ui="btn-next"' "$F")" -ge 1 ] && echo 1 || echo 0)
PREV_OK=$([ "$(grep -c 'data-ui="btn-prev"' "$F")" -ge 1 ] && echo 1 || echo 0)

echo "-- Acceptance --"
echo "BTN_DATA_UI_NEXT=$NEXT_OK"
echo "BTN_DATA_UI_PREV=$PREV_OK"
echo "BACKUP_DIR=$BK"
