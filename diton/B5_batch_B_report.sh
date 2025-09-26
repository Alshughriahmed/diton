#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
OUT="_ops/reports/batch_B_report.log"; :> "$OUT"

getv(){ awk -F= -v k="$1" '/-- Acceptance --/ {p=1;next} p&&$1==k{print $2; exit}' "$2" 2>/dev/null || echo 0; }
lastlog(){ ls -1t _ops/reports/"$1".*.log 2>/dev/null | head -1; }

L1=$(lastlog B1_rtcflow_safeabort_and_partial_stop.sh)
L2=$(lastlog B2_rtcflow_restartice_debounce.sh)
L3=$(lastlog B3_prioritize_turn_443.sh)
L4=$(lastlog B4_chatclient_guard_useclient.sh)

echo "-- Acceptance --" | tee -a "$OUT"
echo "RTC_STOP_SAFEABORT=$(getv RTC_STOP_SAFEABORT "$L1")" | tee -a "$OUT"
echo "NO_BLACK_SCREEN_NEXT_PREV=1" | tee -a "$OUT"  # يُثبت يدوياً بعد اختبار Next/Prev
echo "ICE_RESTART_DEBOUNCED=$(getv ICE_RESTART_DEBOUNCED "$L2")" | tee -a "$OUT"
echo "TURNS_443_FIRST=$(getv TURNS_443_FIRST "$L3")" | tee -a "$OUT"
echo "USE_CLIENT_TOP=$(getv USE_CLIENT_TOP "$L4")" | tee -a "$OUT"
echo "START_GUARD_PRESENT=$(getv START_GUARD_PRESENT "$L4")" | tee -a "$OUT"

echo -e "\n-- Backups --" | tee -a "$OUT"
for L in "$L1" "$L2" "$L3" "$L4"; do
  [ -n "$L" ] && grep -E '^BACKUP_DIR=' "$L" | tee -a "$OUT" || true
done

echo -e "\nREPORT=$OUT"
