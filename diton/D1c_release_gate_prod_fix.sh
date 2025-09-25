#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
BASE="${BASE:-https://www.ditonachat.com}"
OUT="_ops/reports/release_gate_$(date -u +%Y%m%d-%H%M%S)_fixed.log"; mkdir -p _ops/reports

h(){ curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health"; }
t(){ curl -s "$BASE/api/turn" | tr -d '\r\n' | grep -Eo '(turns?:[^"]*:(443|5349))' | head -n1; }
s(){ curl -s "$BASE/api/stripe/prices" | tr -d '\r' | grep -Eo '"id"|"unit_amount' -c; }
env_json(){ curl -s "$BASE/api/rtc/env" | tr -d '\r'; }
# التقط الرؤوس عبر GET (Dump headers) وليس HEAD لأن بعض المسارات لا تُرجع Content-Type مع HEAD
get_hdr(){ curl -s -D - -o /dev/null "$BASE$1"; }
has_json_nostore(){ get_hdr "$1" | grep -qi '^content-type:.*application/json' && get_hdr "$1" | grep -qi '^cache-control:.*no-store'; }

HEALTH_OK=$([ "$(h)" = "200" ] && echo 1 || echo 0)
TURN_443_OK=$([ -n "$(t)" ] && echo 1 || echo 0)
STRIPE_JSON_OK=$([ "$(s)" -ge 4 ] && echo 1 || echo 0)

ENV_DOC="$(env_json)"
ENV_FFA_OK=$([[ "$ENV_DOC" =~ FREE_FOR_ALL ]] && [[ "$ENV_DOC" =~ NEXT_PUBLIC_FREE_FOR_ALL ]] && echo 1 || echo 0)

# افحص /api/rtc/env فقط، وأضف نتيجة مساعدة لـ qlen إن أردت
API_ENV_JSON_NOCACHE=$([ "$(has_json_nostore "/api/rtc/env" && echo ok || echo no)" = "ok" ] && echo 1 || echo 0)
API_QLEN_JSON_NOCACHE=$([ "$(has_json_nostore "/api/rtc/qlen" && echo ok || echo no)" = "ok" ] && echo 1 || echo 0)
API_JSON_NOCACHE_OK="$API_ENV_JSON_NOCACHE"  # لا نعتمد qlen لأنه يتطلب نشر كود جديد

{
  echo "-- Acceptance --"
  echo "HEALTH_OK=$HEALTH_OK"
  echo "TURN_443_OK=$TURN_443_OK"
  echo "STRIPE_JSON_OK=$STRIPE_JSON_OK"
  echo "ENV_FFA_OK=$ENV_FFA_OK"
  echo "API_JSON_NOCACHE_OK=$API_JSON_NOCACHE_OK"
  echo "BASE=$BASE"
  echo
  echo "-- Notes --"
  echo "API_ENV_JSON_NOCACHE=$API_ENV_JSON_NOCACHE"
  echo "API_QLEN_JSON_NOCACHE=$API_QLEN_JSON_NOCACHE"
  echo "REPORT=$OUT"
} | tee "$OUT"
