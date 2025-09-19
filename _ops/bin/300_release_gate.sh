. _ops/bin/disable_alt_screen.sh || true
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"
REP="_ops/reports/release_gate_$(date -u +%Y%m%d-%H%M%S).log"; mkdir -p _ops/reports
h(){ curl -fsS -o /dev/null -w "%{http_code}" "$1" || echo 000; }
g(){ curl -fsS "$1" || echo ""; }
ct(){ curl -fsSI "$1" | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' | tr -d '\r'; }
H=$(h "$BASE/api/health"); ENV=$(g "$BASE/api/rtc/env"); T=$(g "$BASE/api/turn")
SCT=$(ct "$BASE/api/stripe/prices"||true); SB=$(g "$BASE/api/stripe/prices")
T443=$(printf '%s' "$T" | grep -E -c ':443(\?|")' || true)
P4=$(printf '%s' "$SB"|grep -E -c '"currency":"(eur|EUR)"' || true)
SJ=$([ -n "$SCT" ] && printf '%s' "$SCT"|grep -q 'application/json' && echo 1 || echo 0)
{ echo "-- Acceptance --"
  echo "HEALTH_OK=$([ "$H" = 200 ] && echo 1 || echo 0)"
  echo "TURN_443_OK=$([ "$T443" -ge 1 ] && echo 1 || echo 0)"
  echo "STRIPE_JSON_OK=$SJ"
  echo "STRIPE_PLANS_OK=$([ "$P4" -ge 4 ] && echo 1 || echo 0)"
  echo "REPORT=$REP"; } | tee "$REP"
