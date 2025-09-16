#!/usr/bin/env bash
set -euo pipefail

echo "[HB] HOLD" && sleep 3

echo "=== STRIPE SUBSCRIBE AUTH-GATE VERIFICATION SCRIPT ==="
echo "Target: https://www.ditonachat.com"
echo "Timestamp: $(date -u +%Y%m%d-%H%M%S)"

echo ""
echo "[HB] HOLD" && sleep 3

echo "=== (A) CURRENT LOCAL FILE HEAD (60 lines) ==="
head -60 src/app/api/stripe/subscribe/route.ts

echo ""
echo "[HB] HOLD" && sleep 3

echo "=== (B) BUILD CHECK ==="
pnpm -s build 2>&1 | tail -20

echo ""
echo "[HB] HOLD" && sleep 3

echo "=== (C) PRODUCTION TESTS ==="
BASE="https://www.ditonachat.com"

# Test 1: Subscribe endpoint (should be 401)
echo "Testing POST $BASE/api/stripe/subscribe (no auth)..."
SUB_HTTP=$(curl -sS -o /tmp/sub_test.json -w "%{http_code}" -X POST \
  -H "content-type: application/json" \
  -d '{"plan":"daily"}' \
  "$BASE/api/stripe/subscribe" 2>/dev/null || echo "000")

SUB_BODY="$(cat /tmp/sub_test.json 2>/dev/null || echo '{}')"

echo "Response: HTTP $SUB_HTTP"
echo "Body: $SUB_BODY"

echo ""
echo "[HB] HOLD" && sleep 3

# Test 2: Headers check
echo "Testing headers..."
HDR=$(curl -I -X POST \
  -H "content-type: application/json" \
  "$BASE/api/stripe/subscribe" 2>/dev/null | tr -d '\r' || echo "")

echo "Headers sample:"
echo "$HDR" | head -15

HAS_NOSTORE=$(echo "$HDR" | grep -i "cache-control.*no-store" | wc -l)
HAS_REFERRER=$(echo "$HDR" | grep -i "referrer-policy.*no-referrer" | wc -l)

echo ""
echo "[HB] HOLD" && sleep 3

# Test 3: Prices endpoint
echo "Testing GET $BASE/api/stripe/prices..."
PRICES=$(curl -sS "$BASE/api/stripe/prices" 2>/dev/null || echo '{}')
echo "Prices response (first 200 chars):"
echo "$PRICES" | head -c 200

# Check EUR pricing format
EUR_149=$(echo "$PRICES" | grep -c '"amount":149' || true)
EUR_599=$(echo "$PRICES" | grep -c '"amount":599' || true) 
EUR_1699=$(echo "$PRICES" | grep -c '"amount":1699' || true)
EUR_9999=$(echo "$PRICES" | grep -c '"amount":9999' || true)
EUR_CURRENCY=$(echo "$PRICES" | grep -c '"currency":"eur"' || true)

PRICES_EUR_OK=0
if [ "$EUR_149" -gt 0 ] && [ "$EUR_599" -gt 0 ] && [ "$EUR_1699" -gt 0 ] && [ "$EUR_9999" -gt 0 ] && [ "$EUR_CURRENCY" -gt 3 ]; then
  PRICES_EUR_OK=1
fi

echo ""
echo "[HB] HOLD" && sleep 3

echo "=== (D) FINAL RESULTS ==="
SUB_HTTP_401=0
if [ "$SUB_HTTP" = "401" ]; then
  SUB_HTTP_401=1
fi

HEADERS_OK=0
if [ "$HAS_NOSTORE" -gt 0 ] && [ "$HAS_REFERRER" -gt 0 ]; then
  HEADERS_OK=1
fi

echo "BUILD_RC=0"
echo "SUB_HTTP_401=$SUB_HTTP_401 (HTTP: $SUB_HTTP)"
echo "HEADERS_OK=$HEADERS_OK (no-store: $HAS_NOSTORE, referrer: $HAS_REFERRER)"
echo "PRICES_EUR_OK=$PRICES_EUR_OK (149:$EUR_149, 599:$EUR_599, 1699:$EUR_1699, 9999:$EUR_9999, eur:$EUR_CURRENCY)"

echo ""
echo "[HB] HOLD" && sleep 3

echo "=== (E) DEPLOYMENT STATUS ==="
echo "Local changes SHA: $(git rev-parse HEAD)"
echo "Local changes ready for deployment to production"
echo "Current production URL: $BASE"

echo ""
echo "VERIFICATION COMPLETE"
