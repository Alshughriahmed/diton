#!/usr/bin/env bash
set -euo pipefail
BASE="${1:?usage: $0 BASE_URL}"
json='{"ts":'"$(date +%s000)"',"sessionId":"acc-'$(openssl rand -hex 6 2>/dev/null || echo abcd)'","matchMs":1200,"ttfmMs":800,"iceOk":true,"iceTries":1,"turns443":true}'
out="$(curl -sS -X POST "$BASE/api/monitoring/metrics" -H 'content-type: application/json' -d "$json")"
stored="$(echo "$out" | sed -n 's/.*"stored":\([^,}]*\).*/\1/p')"
ok="$(echo "$out" | sed -n 's/.*"ok":\([^,}]*\).*/\1/p')"
echo "-- Acceptance --"
echo "METRICS_API_OK=$ok"
echo "METRICS_STORED=$stored"
echo "-- End Acceptance --"