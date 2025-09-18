#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
mkdir -p _ops/reports _ops/artifacts
PATCH="_ops/artifacts/release.patch"
DIFFS="_ops/reports/release_diffs_$(date -u +%Y%m%d-%H%M%S).log"
git status -uno > "$DIFFS" || true
git diff --patch > "$PATCH" || true

# سحب خلاصات تقارير A/B/C
sum(){ local f="$1"; [ -f "$f" ] && { echo "## $(basename "$f")"; sed -n '/-- Acceptance --/,$p' "$f"; echo; } || true; }
OUT="_ops/reports/PR_SUMMARY.md"; :> "$OUT"
{
  echo "# Release Summary"
  echo
  for f in _ops/reports/batch_A_report.log _ops/reports/batch_B_report.log _ops/reports/batch_C_report.log; do sum "$f"; done
  echo "## Artifacts"; echo "- Patch: $PATCH"; echo "- Diffs: $DIFFS"
} >> "$OUT"

echo "-- Acceptance --"
echo "PATCH_CREATED=$([ -s "$PATCH" ] && echo 1 || echo 0)"
echo "PR_SUMMARY=_ops/reports/PR_SUMMARY.md"
