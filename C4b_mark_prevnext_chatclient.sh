#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/C4b_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/ChatClient.tsx"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# 1) حقن data-ui على أي عنصر onClick يستدعي onPrev/handlePrev/goPrev
perl -0777 -i -pe '
  s/<([A-Za-z][\w-]*)(\s+[^>]*onClick=\{[^}]*\b(onPrev|handlePrev|goPrev)\b[^}]*\}[^>]*)>/"<".$1." data-ui=\"btn-prev\" ". $2 .">"/ge;
  s/<([A-Za-z][\w-]*)(\s+[^>]*onClick=\{[^}]*\b(onNext|handleNext|goNext)\b[^}]*\}[^>]*)>/"<".$1." data-ui=\"btn-next\" ". $2 .">"/ge;
' "$F"

# 2) إن لم يُعثر على onPrev، وسم زر يحمل نص Prev
if ! grep -q 'data-ui="btn-prev"' "$F"; then
  perl -0777 -i -pe 's/<button([^>]*)>(\s*Prev\s*<\/button>)/"<button data-ui=\"btn-prev\"".$1.">$2"/ge' "$F" || true
fi

echo "-- Acceptance --"
echo "BTN_DATA_UI_PREV=$([ "$(grep -c 'data-ui="btn-prev"' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BTN_DATA_UI_NEXT=$([ "$(grep -c 'data-ui="btn-next"' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
