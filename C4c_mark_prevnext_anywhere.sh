#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/C4c_${TS}"; mkdir -p "$BK" _ops/reports

# استهدف كل ملفات chat التي قد تحوي الأزرار
mapfile -t FILES < <(grep -RIl --include='*.tsx' -E 'onPrev|onNext|handlePrev|handleNext|goPrev|goNext|>\\s*Prev\\s*<|>\\s*Next\\s*<|aria-label="Prev"|aria-label="Next"' src/app/chat 2>/dev/null || true)
[ "${#FILES[@]}" -gt 0 ] || { echo "-- Acceptance --"; echo "BTN_DATA_UI_PREV=0"; echo "BTN_DATA_UI_NEXT=0"; exit 0; }

PREV_SUM=0; NEXT_SUM=0
for F in "${FILES[@]}"; do
  mkdir -p "$BK/$(dirname "$F")"; cp -a "$F" "$BK/"
  # onClick يستدعي Prev/Next
  perl -0777 -i -pe '
    s/<([A-Za-z][\w-]*)(\s+[^>]*onClick=\{[^}]*\b(onPrev|handlePrev|goPrev)\b[^}]*\}[^>]*)>/<${1} data-ui="btn-prev"${2}>/g;
    s/<([A-Za-z][\w-]*)(\s+[^>]*onClick=\{[^}]*\b(onNext|handleNext|goNext)\b[^}]*\}[^>]*)>/<${1} data-ui="btn-next"${2}>/g;
  ' "$F" || true
  # أزرار نصية أو aria-label
  perl -0777 -i -pe '
    s/<button(?![^>]*data-ui=)([^>]*)>\s*Prev\s*<\/button>/<button data-ui="btn-prev"$1>Prev<\/button>/g;
    s/<button(?![^>]*data-ui=)([^>]*)>\s*Next\s*<\/button>/<button data-ui="btn-next"$1>Next<\/button>/g;
    s/<([A-Za-z][\w-]*)(?![^>]*data-ui=)([^>]*aria-label="Prev"[^>]*)>/<${1} data-ui="btn-prev"$2>/g;
    s/<([A-Za-z][\w-]*)(?![^>]*data-ui=)([^>]*aria-label="Next"[^>]*)>/<${1} data-ui="btn-next"$2>/g;
  ' "$F" || true
  PREV_SUM=$(( PREV_SUM + $(grep -c 'data-ui="btn-prev"' "$F" || true) ))
  NEXT_SUM=$(( NEXT_SUM + $(grep -c 'data-ui="btn-next"' "$F" || true) ))
done

echo "-- Acceptance --"
echo "BTN_DATA_UI_PREV=$([ $PREV_SUM -gt 0 ] && echo 1 || echo 0)"
echo "BTN_DATA_UI_NEXT=$([ $NEXT_SUM -gt 0 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
