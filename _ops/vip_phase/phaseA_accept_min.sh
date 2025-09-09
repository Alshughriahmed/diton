set -euo pipefail
BASE="${1:-https://www.ditonachat.com}"
echo "-- Acceptance --"
echo -n "HAS_VIP_CLAIM_ROUTE="; [ -f src/app/api/vip/claim/route.ts ] && echo 1 || echo 0
echo -n "SUBSCRIBE_POINTS_TO_CLAIM="; grep -q '/api/vip/claim' src/app/api/stripe/subscribe/route.ts && echo 1 || echo 0
echo -n "STRIPE_PLANS_COUNT="; curl -s "$BASE/api/stripe/prices" | grep -o '"id":"' | wc -l
echo -n "PERMISSIONS_POLICY_HEADER_PRESENT="; curl -sI "$BASE/chat" | tr -d '\r' | grep -qi "permissions-policy:.*camera=(self), microphone=(self)" && echo 1 || echo 0
echo "-- End Acceptance --"
