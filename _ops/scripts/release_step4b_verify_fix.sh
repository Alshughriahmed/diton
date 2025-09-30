#!/usr/bin/env bash
set -Eeuo pipefail; export TERM=dumb CI=1
BASE="https://www.ditonachat.com"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
R="_ops/reports/release_step4b_verify_fix_${STAMP}.log"
mkdir -p "${R%/*}" _ops/reports

# Stripe JSON (fallback): اقبل currency=eur أو وجود unit_amount
ok_stripe=0
STRIPE_BODY="$(curl -fsS "$BASE/api/stripe/prices" || true)"
echo "$STRIPE_BODY" > "_ops/reports/stripe_body_${STAMP}.json"
if echo "$STRIPE_BODY" | grep -qiE currency[[:space:]]*:[[:space:]]*(eur|EUR)
