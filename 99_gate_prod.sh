#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"
TS="$(date -u +%Y%m%d-%H%M%S)"
OUT="_ops/reports/gate_prod_${TS}.log"; mkdir -p _ops/reports

# Helpers
h(){ curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health"; }
turn(){ curl -s "$BASE/api/turn" | tr -d '\r\n' | grep -Eo '(turns?:[^"]*:(443|5349))' | head -n1; }
stripe_count(){ curl -s "$BASE/api/stripe/prices" | tr -d '\r' | grep -Eo '"id"|"unit_amount' -c; }
env_json(){ curl -s "$BASE/api/rtc/env" | tr -d '\r'; }
hdr(){ curl -s -D - -o /dev/null "$BASE$1"; }

# Checks
HEALTH_OK=$([ "$(h)" = "200" ] && echo 1 || echo 0)
TURN_443_OK=$([ -n "$(turn)" ] && echo 1 || echo 0)
STRIPE_JSON_OK=$([ "$(stripe_count)" -ge 4 ] && echo 1 || echo 0)

ENV_DOC="$(env_json)"
ENV_FFA_OK=$([[ "$ENV_DOC" =~ FREE_FOR_ALL ]] && [[ "$ENV_DOC" =~ NEXT_PUBLIC_FREE_FOR_ALL ]] && echo 1 || echo 0)

HDR_ENV="$(hdr /api/rtc/env)"
API_JSON_NOCACHE_OK=$(
  echo "$HDR_ENV" | grep -qi '^content-type:.*application/json' &&
  echo "$HDR_ENV" | grep -qi '^cache-control:.*no-store' && echo 1 || echo 0
)

{
  echo "-- Acceptance --"
  echo "GATE_HEALTH_OK=$HEALTH_OK"
  echo "GATE_TURN_443_OK=$TURN_443_OK"
  echo "GATE_STRIPE_JSON_OK=$STRIPE_JSON_OK"
  echo "GATE_ENV_FFA_OK=$ENV_FFA_OK"
  echo "API_JSON_NOCACHE_OK=$API_JSON_NOCACHE_OK"
  echo "BASE=$BASE"
  echo
  echo "-- Snippets --"
  echo "[/api/health]";  curl -s -I "$BASE/api/health" | sed -n '1,12p'
  echo; echo "[/api/turn]"; turn || true
  echo; echo "[/api/stripe/prices]"; curl -s "$BASE/api/stripe/prices" | head -c 280; echo
  echo; echo "[/api/rtc/env headers]"; echo "$HDR_ENV" | sed -n '1,12p'
  echo; echo "[/api/rtc/env body]"; echo "$ENV_DOC" | head -c 280; echo
  echo; echo "REPORT=$OUT"
} | tee "$OUT"
