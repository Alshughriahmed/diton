#!/bin/bash
# Acceptance script for FREE_FOR_ALL upsell changes
BASE="${1:-http://localhost:3000}"
echo "-- Acceptance --"
echo -n "AUTH_PROVIDERS_NONEMPTY="; curl -s "$BASE/api/auth/providers" | grep -q "google" && echo 1 || echo 0
echo "AUTH_SIGNIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auth/signin")"
echo -n "STRIPE_PLANS_COUNT="; curl -s "$BASE/api/stripe/prices" | grep -o '"id":"' | wc -l
codes=""; for i in {1..5}; do c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/match/next"); codes+="$c,"; done; echo "MATCH_BURST=$codes"
echo -n "PERMISSIONS_POLICY_HEADER_PRESENT="; curl -sI "$BASE/chat" | grep -qi "permissions-policy:.*camera=(self), microphone=(self)" && echo 1 || echo 0
# Guest messages (expect all 200 in FREE_FOR_ALL=1)
codes=""; for i in {1..12}; do c=$(curl -s -o /dev/null -w "%{http_code}" -H 'content-type: application/json' \
  -d '{"txt":"hi"}' "$BASE/api/message"); codes+="$c,"; done; echo "GUEST_MSG_CODES=$codes"
echo "-- End Acceptance --"