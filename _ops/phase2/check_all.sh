#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:3000}"
repo_dir="$(pwd)"
report="_ops/reports/phase2_check_$(date +%s).txt"
mkdir -p "$(dirname "$report")"

jval(){ node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s)$1)}catch{console.log('')}})" ;}

echo "-- Acceptance --" | tee "$report"

# Auth
AUTH_PROVIDERS=$(curl -fsS "$BASE/api/auth/providers" || true)
AUTH_OK=0; [[ -n "$AUTH_PROVIDERS" ]] && AUTH_OK=1
echo "AUTH_PROVIDERS_NONEMPTY=$AUTH_OK" | tee -a "$report"

SIGNIN_CODE=$(curl -I -s "$BASE/api/auth/signin" | awk 'NR==1{print $2}')
echo "AUTH_SIGNIN_CODE=$SIGNIN_CODE" | tee -a "$report"

# Stripe prices
PRICES=$(curl -fsS "$BASE/api/stripe/prices" || true)
PLANS_COUNT=$(printf "%s" "$PRICES" | jval ".plans && '.'.repeat(JSON.parse(process.argv[1]).plans.length).length" "$PRICES" 2>/dev/null || true)
[[ -z "$PLANS_COUNT" ]] && PLANS_COUNT=$(printf "%s" "$PRICES" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{let j=JSON.parse(s);console.log(j.length|| (j.plans||[]).length || 0)}catch{console.log(0)}})")
echo "STRIPE_PLANS_COUNT=$PLANS_COUNT" | tee -a "$report"

# Match ratelimit burst (5)
codes=""
for i in 1 2 3 4 5; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/match/next?gender=all")
  codes+="${code},"
  sleep 0.05
done
echo "MATCH_BURST=$codes" | tee -a "$report"

# Permissions-Policy after age
PP=$(curl -I -s "$BASE/chat" | tr -d '\r' | awk -F': ' 'BEGIN{IGNORECASE=1}/^permissions-policy:/{print $2}')
echo "PERMISSIONS_POLICY_HEADER_PRESENT=$( [[ -n "$PP" ]] && echo 1 || echo 0 )" | tee -a "$report"

# VIP guards (تخطَّ إذا FREE_FOR_ALL=1)
VIP_EXPECT=SKIPPED
if [[ "${FREE_FOR_ALL:-1}" != "1" ]]; then
  codeG=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/match/next?gender=male&gender=female")
  codeC=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/match/next?countries=DE,FR")
  VIP_EXPECT=$([[ "$codeG" == "403" && "$codeC" == "403" ]] && echo OK || echo FAIL)
fi
echo "VIP_GUARDS=$VIP_EXPECT" | tee -a "$report"

# Guest message limit (server)
msgCodes=""
for i in $(seq 1 12); do
  c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/message" -H "content-type: application/json" --data '{"txt":"hi"}')
  msgCodes+="$c,"
done
echo "GUEST_MSG_CODES=$msgCodes" | tee -a "$report"

echo "REPORT=$report" | tee -a "$report"
echo "-- End Acceptance --" | tee -a "$report"