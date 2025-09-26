. _ops/bin/disable_alt_screen.sh || true
set -euo pipefail
TS=$(date -u +%Y%m%d-%H%M%S); REP="_ops/reports/verify_metrics_stripe_${TS}.log"
mkdir -p _ops/reports
BASE="${BASE:-http://127.0.0.1:3000}"

echo "BASE=$BASE" | tee "$REP"

# 0) Health
H=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health" || true)
echo "HEALTH=$H" | tee -a "$REP"

# 1) Metrics
M=$(curl -sS -X POST "$BASE/api/monitoring/metrics" -H 'content-type: application/json' \
     -d '{"ttfmMs":111,"iceOk":true,"turns443":true,"matchMs":222}' || true)
echo "METRICS_RAW=$M" | tee -a "$REP"
METRICS_STORED=$(echo "$M" | jq -e '.stored==true' >/dev/null 2>&1 && echo 1 || echo 0)

# 2) Stripe
S=$(curl -sS "$BASE/api/stripe/prices" || true)
echo "STRIPE_RAW_HEAD=$(echo "$S" | head -c 200)" | tee -a "$REP"
LEN=$(echo "$S" | jq 'length' 2>/dev/null || echo -1)
ALL_EUR=$(echo "$S" | jq -e 'all(.[]; .currency=="eur")' >/dev/null 2>&1 && echo 1 || echo 0)

echo "-- Acceptance --" | tee -a "$REP"
echo "METRICS_STORED=$METRICS_STORED" | tee -a "$REP"
echo "STRIPE_LEN=$LEN" | tee -a "$REP"
echo "STRIPE_ALL_EUR=$ALL_EUR" | tee -a "$REP"
echo "REPORT=$REP" | tee -a "$REP"
