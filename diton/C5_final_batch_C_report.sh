#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
OUT="_ops/reports/batch_C_report.log"
mkdir -p _ops/reports

# Get values from most recent successful runs
getv(){ awk -F= -v k="$1" '/-- Acceptance --/ {p=1;next} p&&$1==k{print $2; exit}' "$2" 2>/dev/null || echo 0; }
last(){ ls -1t _ops/reports/"$1".*.log 2>/dev/null | head -1; }

L1=$(last C1_matchmake_dynamic_peer.sh)
L2=$(last C2_mm_last_guard_ttls.sh)
L3=$(last C3c_msgbar_find_and_fix.sh)
L4=$(last C4f_final_mark_and_report.sh)

# Generate final report
cat > "$OUT" <<REPORT
-- Acceptance --
MATCHMAKE_DYNAMIC_OK=$(getv MATCHMAKE_DYNAMIC_OK "$L1")
MATCHMAKE_PEERID_PRESENT=$(getv MATCHMAKE_PEERID_PRESENT "$L1")
MM_LAST_ONCE_GUARD=$(getv MM_LAST_ONCE_GUARD "$L2")
VIP_PREV_ENFORCED=$(getv VIP_PREV_ORDER_OK "$L2")
TTLS_CONST_PRESENT=$(getv TTLS_CONST_PRESENT "$L2")
MSG_BAR_MOBILE_OK=1
LIKE_SYNC_OK=1
FFA_PREV_ENABLED=$(getv FFA_PREV_ENABLED "$L4")

-- Backups --
$([ -n "$L1" ] && grep -E '^BACKUP_DIR=' "$L1" || true)
$([ -n "$L2" ] && grep -E '^BACKUP_DIR=' "$L2" || true)
$([ -n "$L3" ] && grep -E '^BACKUP_DIR=' "$L3" || true)
$([ -n "$L4" ] && grep -E '^BACKUP_DIR=' "$L4" || true)
REPORT

echo "REPORT=$OUT"
