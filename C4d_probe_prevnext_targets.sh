#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
OUT="_ops/reports/C4d_probe_prevnext_$(date -u +%Y%m%d-%H%M%S).log"; mkdir -p _ops/reports
p(){ echo; echo "=== $1 ===" | tee -a "$OUT"; }
p "scan"
grep -RInE --include='*.tsx' \
  '(onPrev|handlePrev|goPrev|onNext|handleNext|goNext|aria-label="(Prev|Next|السابق|التالي)"|title="(Prev|Next|السابق|التالي)"|>\\s*(Prev|Next|السابق|التالي)\\s*<|Chevron(Left|Right)|Arrow(Left|Right))' \
  src/app 2>/dev/null | tee -a "$OUT" || true
echo "-- Acceptance --" | tee -a "$OUT"
echo "PROBE_OK=1" | tee -a "$OUT"
echo "REPORT=$OUT" | tee -a "$OUT"
