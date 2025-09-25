
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"

h(){ curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health"; }
t(){ curl -s "$BASE/api/turn" | tr -d '\n' | grep -Eo '(turns?:[^"]*:(443|5349))' | head -n1; }
s(){ curl -s "$BASE/api/stripe/prices" | tr -d '\n' | grep -Eo '"id"|"unit_amount' -c; }
e(){ curl -s "$BASE/api/rtc/env" | tr -d '\n'; }

HEALTH_OK=$([ "$(h)" = "200" ] && echo 1 || echo 0)
TURN_443_OK=$([ -n "$(t)" ] && echo 1 || echo 0)
STRIPE_JSON_OK=$([ "$(s)" -ge 4 ] && echo 1 || echo 0)
ENV_OUT="$(e)"
ENV_FFA_OK=$([[ "$ENV_OUT" =~ FREE_FOR_ALL ]] && [[ "$ENV_OUT" =~ NEXT_PUBLIC_FREE_FOR_ALL ]] && echo 1 || echo 0)

echo "-- Acceptance --"
echo "HEALTH_OK=$HEALTH_OK"
echo "TURN_443_OK=$TURN_443_OK"
echo "STRIPE_JSON_OK=$STRIPE_JSON_OK"
echo "STRIPE_PLANS_OK=$([ "$STRIPE_JSON_OK" -eq 1 ] && echo 1 || echo 0)"
echo "ENV_FFA_OK=$ENV_FFA_OK"
echo "BASE=$BASE"
