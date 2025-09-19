#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
OUT="_ops/reports/ttls_prod_$(date -u +%Y%m%d-%H%M%S).log"; mkdir -p _ops/reports
URL="${UPSTASH_REDIS_REST_URL:-}"; TOK="${UPSTASH_REDIS_REST_TOKEN:-}"
if [ -z "$URL" ] || [ -z "$TOK" ]; then
  echo "-- Acceptance --" | tee "$OUT"
  echo "TTLS_CHECK_SKIPPED=1" | tee -a "$OUT"
  echo "REASON=NO_UPSTASH_CREDS" | tee -a "$OUT"
  echo "REPORT=$OUT" | tee -a "$OUT"
  exit 0
fi
auth(){ echo "Authorization: Bearer $TOK"; }
jqpttl(){ curl -s -X POST "$URL/pipeline" -H "$(auth)" -H "content-type: application/json" -d "$1" | tr -d '\r'; }
PAY='{"commands":[["PTTL","rtc:prev-wish:*"],["PTTL","rtc:prev-for:*"],["PTTL","rtc:last:*"],["PTTL","rtc:pair:*"],["PTTL","rtc:pair:map:*"],["PTTL","rtc:attrs:*"],["PTTL","rtc:filters:*"],["PTTL","rtc:seen:*"]]}'
RES="$(jqpttl "$PAY")"
echo "-- Acceptance --" | tee "$OUT"
echo "TTLS_CHECK_SKIPPED=0" | tee -a "$OUT"
echo "RAW=$RES" | tee -a "$OUT"
echo "REPORT=$OUT" | tee -a "$OUT"
