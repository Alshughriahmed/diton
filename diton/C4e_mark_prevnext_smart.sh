#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/C4e_${TS}"; mkdir -p "$BK" _ops/reports
# اجمع الملفات المرشحة من الفحص السابق أو ابحث مباشرة
mapfile -t FILES < <(grep -RIl --include='*.tsx' -E \
  'onPrev|handlePrev|goPrev|onNext|handleNext|goNext|aria-label="(Prev|Next|السابق|التالي)"|title="(Prev|Next|السابق|التالي)"|>\\s*(Prev|Next|السابق|التالي)\\s*<|Chevron(Left|Right)|Arrow(Left|Right)' \
  src/app 2>/dev/null || true)

PREV=0; NEXT=0
for F in "${FILES[@]}"; do
  mkdir -p "$BK/$(dirname "$F")"; cp -a "$F" "$BK/"
  # onClick يدعو Prev/Next
  perl -0777 -i -pe '
    s/<([A-Za-z][\w-]*)(?![^>]*\bdata-ui=)(\s+[^>]*onClick=\{[^}]*\b(onPrev|handlePrev|goPrev)\b[^}]*\}[^>]*)>/<${1} data-ui="btn-prev"$2>/g;
    s/<([A-Za-z][\w-]*)(?![^>]*\bdata-ui=)(\s+[^>]*onClick=\{[^}]*\b(onNext|handleNext|goNext)\b[^}]*\}[^>]*)>/<${1} data-ui="btn-next"$2>/g;
  ' "$F" || true
  # aria-label أو title
  perl -0777 -i -pe '
    s/<([A-Za-z][\w-]*)(?![^>]*\bdata-ui=)([^>]*aria-label="(Prev|السابق)"[^>]*)>/<${1} data-ui="btn-prev"$2>/g;
    s/<([A-Za-z][\w-]*)(?![^>]*\bdata-ui=)([^>]*aria-label="(Next|التالي)"[^>]*)>/<${1} data-ui="btn-next"$2>/g;
    s/<([A-Za-z][\w-]*)(?![^>]*\bdata-ui=)([^>]*title="(Prev|السابق)"[^>]*)>/<${1} data-ui="btn-prev"$2>/g;
    s/<([A-Za-z][\w-]*)(?![^>]*\bdata-ui=)([^>]*title="(Next|التالي)"[^>]*)>/<${1} data-ui="btn-next"$2>/g;
  ' "$F" || true
  # أزرار نصية مباشرة
  perl -0777 -i -pe '
    s/<button(?![^>]*\bdata-ui=)([^>]*)>\s*(Prev|السابق)\s*<\/button>/<button data-ui="btn-prev"$1>$2<\/button>/g;
    s/<button(?![^>]*\bdata-ui=)([^>]*)>\s*(Next|التالي)\s*<\/button>/<button data-ui="btn-next"$1>$2<\/button>/g;
  ' "$F" || true

  PREV=$(( PREV + $(grep -c 'data-ui="btn-prev"' "$F" || true) ))
  NEXT=$(( NEXT + $(grep -c 'data-ui="btn-next"' "$F" || true) ))
done

echo "-- Acceptance --"
echo "BTN_DATA_UI_PREV=$([ $PREV -gt 0 ] && echo 1 || echo 0)"
echo "BTN_DATA_UI_NEXT=$([ $NEXT -gt 0 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
