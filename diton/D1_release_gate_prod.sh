#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
BASE="${BASE:-https://www.ditonachat.com}"
OUT="_ops/reports/release_gate_$(date -u +%Y%m%d-%H%M%S).log"; mkdir -p _ops/reports

h(){ curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health"; }
t(){ curl -s "$BASE/api/turn" | tr -d '\r\n' | grep -Eo '(turns?:[^"]*:(443|5349))' | head -n1; }
s(){ curl -s "$BASE/api/stripe/prices" | tr -d '\r' | grep -Eo '"id"|"unit_amount' -c; }  # يقبل fallback
e(){ curl -s "$BASE/api/rtc/env" | tr -d '\r'; }
hdr_ok(){ local p="$1"; local H="$(curl -s -I "$BASE$p")"; echo "$H" | grep -qi '^content-type:.*application/json' && echo "$H" | grep -qi '^cache-control:.*no-store'; }

HEALTH_OK=$([ "$(h)" = "200" ] && echo 1 || echo 0)
TURN_443_OK=$([ -n "$(t)" ] && echo 1 || echo 0)
STRIPE_JSON_OK=$([ "$(s)" -ge 4 ] && echo 1 || echo 0)
ENV_OUT="$(e)"
ENV_FFA_OK=$([[ "$ENV_OUT" =~ FREE_FOR_ALL ]] && [[ "$ENV_OUT" =~ NEXT_PUBLIC_FREE_FOR_ALL ]] && echo 1 || echo 0)
API_JSON_NOCACHE_OK=$(
  hdr_ok "/api/rtc/env" >/dev/null 2>&1 && hdr_ok "/api/rtc/qlen" >/dev/null 2>&1 && echo 1 || echo 0
)

{
  echo "-- Acceptance --"
  echo "HEALTH_OK=$HEALTH_OK"
  echo "TURN_443_OK=$TURN_443_OK"
  echo "STRIPE_JSON_OK=$STRIPE_JSON_OK"
  echo "ENV_FFA_OK=$ENV_FFA_OK"
  echo "API_JSON_NOCACHE_OK=$API_JSON_NOCACHE_OK"
  echo "BASE=$BASE"
  echo
  echo "-- Snippets --"
  echo "[/api/health]";  curl -s -I "$BASE/api/health" | sed -n '1,10p'
  echo; echo "[/api/turn]";  curl -s "$BASE/api/turn" | head -c 300; echo
  echo; echo "[/api/stripe/prices]"; curl -s "$BASE/api/stripe/prices" | head -c 300; echo
  echo; echo "[/api/rtc/env]"; curl -s -I "$BASE/api/rtc/env" | sed -n '1,10p'
  echo; echo "[/api/rtc/qlen]"; curl -s -I "$BASE/api/rtc/qlen" | sed -n '1,10p'
  echo; echo "REPORT=$OUT"
} | tee "$OUT"
