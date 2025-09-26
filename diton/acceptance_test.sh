#!/usr/bin/env bash
# Acceptance test for batch-rtc-fix-v2
set -euo pipefail
TS="$(date +%Y%m%d-%H%M%S)"
REP="_ops/reports/batch_rtc_fix_v2_${TS}.txt"
mkdir -p "_ops/reports"

echo "-- Start Acceptance $TS --" | tee "$REP"

# Test against local development server
BASE="${1:-http://localhost:3000}"

{
  echo "-- Acceptance Tests --"
  echo -n "MESSAGE_TEXT_CODE=";   curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/message" -H 'content-type: application/json' -d '{"text":"hi"}'; echo
  echo -n "MESSAGE_MESSAGE_CODE=";curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/message" -H 'content-type: application/json' -d '{"message":"hi"}'; echo  
  echo -n "MESSAGE_TXT_CODE=";    curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/message" -H 'content-type: application/json' -d '{"txt":"hi"}'; echo
  echo -n "ENQUEUE_POST_CODE=";   curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/rtc/enqueue" -H 'content-type: application/json' -d '{"anonId":"acc-'"$TS"'"}'; echo
  echo -n "ICE_POST_CODE=";       curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/rtc/ice" -H 'content-type: application/json' -d '{"pairId":"test","candidate":{"type":"candidate"}}'; echo
  echo -n "ICE_GET_CODE=";        curl -s -o /dev/null -w "%{http_code}" "$BASE/api/rtc/ice?pairId=test"; echo
  echo -n "RTC_PING="; curl -s "$BASE/api/rtc/ping" | tr -d "\n" | sed "s/[[:space:]]//g"; echo
  echo -n "RTC_QLEN_AFTER="; curl -s "$BASE/api/rtc/qlen" | tr -d "\n" | sed "s/[[:space:]]//g"; echo
  echo "-- End Acceptance --"
} | tee -a "$REP"

echo "REPORT=$REP" | tee -a "$REP"
echo "-- Done --" | tee -a "$REP"