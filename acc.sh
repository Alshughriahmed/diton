#!/usr/bin/env bash
BASE="${1:-https://www.ditonachat.com}"
set -e

echo "-- Acceptance --"

# Auth/Stripe
echo -n "AUTH_PROVIDERS_NONEMPTY="; curl -s "$BASE/api/auth/providers" | grep -q "google" && echo 1 || echo 0
echo -n "STRIPE_PLANS_COUNT="; curl -s "$BASE/api/stripe/prices" | grep -o '"id":"' | wc -l

# Headers
HP=$(curl -sI "$BASE/chat")
echo -n "PERMISSIONS_POLICY_HEADER_PRESENT="; echo "$HP" | grep -qi "permissions-policy:.*camera=(self), microphone=(self)" && echo 1 || echo 0
echo -n "HSTS_HEADER_PRESENT="; echo "$HP" | grep -qi "^strict-transport-security:" && echo 1 || echo 0

# Match burst
codes=""; for i in {1..5}; do c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/match/next"); codes+="$c,"; done
echo "MATCH_BURST=$codes"

# Guest message limit (production may be FREE_FOR_ALL=1 → skip)
codes=""; for i in {1..12}; do c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/message" -H 'content-type: application/json' -d '{"txt":"hi"}'); codes+="$c,"; done
echo "GUEST_MSG_CODES=$codes"

# RTC readiness
echo -n "RTC_PING="; curl -s "$BASE/api/rtc/ping" | tr -d '\n' | sed 's/[[:space:]]//g'
echo
echo -n "RTC_QLEN="; curl -s "$BASE/api/rtc/qlen" | tr -d '\n' | sed 's/[[:space:]]//g'
echo

echo "-- End Acceptance --"