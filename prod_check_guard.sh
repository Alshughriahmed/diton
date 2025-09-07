#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"
QS="gender=all&countries=US"

echo "# Burst 5 requests in ~1s"
codes=()
for i in {1..5}; do
  c=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/match/next?$QS")
  codes+=("$c")
done
printf "CODES:%s\n" "${codes[*]}"

echo "# If guard exists, at least one 429 is expected when spamming."
echo "# Single request after short sleep (should be 200)"
sleep 3
curl -sS -D - -o /dev/null "$BASE/api/match/next?$QS" | awk 'NR==1{print}'
