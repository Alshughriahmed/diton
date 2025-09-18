#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
OUT="_ops/reports/batch_D_report.log"; :> "$OUT"
last(){ ls -1t _ops/reports/release_gate_*fixed.log _ops/reports/release_gate_*.log 2>/dev/null | head -1; }
GATE="$(last)"
TTLS="$(ls -1t _ops/reports/ttls_prod_*.log 2>/dev/null | head -1)"
gv(){ awk -F= -v k="$1" '/-- Acceptance --/ {p=1;next} p&&$1==k{print $2; exit}' "$2" 2>/dev/null || echo 0; }
echo "-- Acceptance --" | tee -a "$OUT"
echo "GATE_HEALTH_OK=$(gv HEALTH_OK "$GATE")" | tee -a "$OUT"
echo "GATE_TURN_443_OK=$(gv TURN_443_OK "$GATE")" | tee -a "$OUT"
echo "GATE_STRIPE_JSON_OK=$(gv STRIPE_JSON_OK "$GATE")" | tee -a "$OUT"
echo "GATE_ENV_FFA_OK=$(gv ENV_FFA_OK "$GATE")" | tee -a "$OUT"
echo "API_JSON_NOCACHE_OK=$(gv API_JSON_NOCACHE_OK "$GATE")" | tee -a "$OUT"
echo "TTLS_CHECK_SKIPPED=$(gv TTLS_CHECK_SKIPPED "$TTLS")" | tee -a "$OUT"
echo "PR_SUMMARY=_ops/reports/PR_SUMMARY.md" | tee -a "$OUT"
echo -e "\nREPORT=$OUT" | tee -a "$OUT"
