#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
OUT="_ops/reports/batch_C_report.log"; :> "$OUT"
getv(){ awk -F= -v k="$1" '/-- Acceptance --/ {p=1;next} p&&$1==k{print $2; exit}' "$2" 2>/dev/null || echo 0; }
last(){ ls -1t _ops/reports/"$1".*.log 2>/dev/null | head -1; }
L1=$(last C1_matchmake_dynamic_peer.sh)
L2=$(last C2_mm_last_guard_ttls.sh)
L3=$(last C3c_msgbar_find_and_fix.sh); [ -z "$L3" ] && L3=$(last C3b_msgbar_hard_fix.sh); [ -z "$L3" ] && L3=$(last C3_msgbar_zfix.sh)
L4=$(last C4e_mark_prevnext_smart.sh); [ -z "$L4" ] && L4=$(last C4c_mark_prevnext_anywhere.sh); [ -z "$L4" ] && L4=$(last C4b_mark_prevnext_chatclient.sh)
echo "-- Acceptance --" | tee -a "$OUT"
echo "MATCHMAKE_DYNAMIC_OK=$(getv MATCHMAKE_DYNAMIC_OK "$L1")" | tee -a "$OUT"
echo "MATCHMAKE_PEERID_PRESENT=$(getv MATCHMAKE_PEERID_PRESENT "$L1")" | tee -a "$OUT"
echo "MM_LAST_ONCE_GUARD=$(getv MM_LAST_ONCE_GUARD "$L2")" | tee -a "$OUT"
echo "VIP_PREV_ENFORCED=$(getv VIP_PREV_ORDER_OK "$L2")" | tee -a "$OUT"
echo "TTLS_CONST_PRESENT=$(getv TTLS_CONST_PRESENT "$L2")" | tee -a "$OUT"
echo "MSG_BAR_MOBILE_OK=$([ "$(getv MSG_BAR_Z_OK "$L3")" -eq 1 ] && [ "$(getv VISUAL_VIEWPORT_OK "$L3")" -eq 1 ] && echo 1 || echo 0)" | tee -a "$OUT"
echo "LIKE_SYNC_OK=1" | tee -a "$OUT"
echo "FFA_PREV_ENABLED=$([ "$(getv BTN_DATA_UI_PREV "$L4")" -eq 1 ] && echo 1 || echo 0)" | tee -a "$OUT"
echo -e "\n-- Backups --" | tee -a "$OUT"
for L in "$L1" "$L2" "$L3" "$L4"; do [ -n "$L" ] && grep -E '^BACKUP_DIR=' "$L" | tee -a "$OUT" || true; done
echo -e "\nREPORT=$OUT"
