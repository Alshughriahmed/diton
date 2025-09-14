#!/usr/bin/env bash
set -euo pipefail
BASE="${1:?usage: $0 BASE_URL}"
json='{"ts":'"$(date +%s000)"',"sessionId":"acc-'$(openssl rand -hex 6 2>/dev/null || echo abcd)'","matchMs":1200,"ttfmMs":800,"iceOk":true,"iceTries":1,"turns443":true}'

# Make the API call and parse response with jq
out="$(curl -sS -X POST "$BASE/api/monitoring/metrics" -H 'content-type: application/json' -d "$json")"

# Use jq for reliable JSON parsing, with fallback values if fields don't exist
stored="$(echo "$out" | jq -r '.stored // false')"
ok="$(echo "$out" | jq -r '.ok // false')"

echo "-- Acceptance --"
echo "METRICS_API_OK=$ok"
echo "METRICS_STORED=$stored"
echo "-- End Acceptance --"