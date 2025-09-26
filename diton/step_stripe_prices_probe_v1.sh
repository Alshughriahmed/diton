#!/usr/bin/env bash
set -Eeuo pipefail
RG="grep -RInE"
OUT="_ops/reports/stripe_prices_probe_$(date +%Y%m%d-%H%M%S)"; mkdir -p "$OUT"

# locate route
ROUTE="$($RG 'app/api/stripe/prices/.*/route\.(t|j)sx?' src 2>/dev/null | head -n1 | awk -F: '{print $1}')"
[ -n "${ROUTE:-}" ] && sed -n '1,200p' "$ROUTE" > "$OUT/route_head.txt" || true

# detect mode: stub/basic vs env IDs vs list-all
HAS_BASIC=$($RG '"basic"|id[[:space:]]*:[[:space:]]*"basic"' "${ROUTE:-/dev/null}" >/dev/null 2>&1 && echo 1 || echo 0)
HAS_LIST_ALL=$($RG 'stripe\.prices\.list|listPrices' "${ROUTE:-/dev/null}" >/dev/null 2>&1 && echo 1 || echo 0)
ENV_NAMES="$($RG 'process\.env\.[A-Z0-9_]+' "${ROUTE:-/dev/null}" 2>/dev/null | sed -E 's/.*process\.env\.([A-Z0-9_]+).*/\1/' | sort -u)"
ENV_USED=$(echo "$ENV_NAMES" | tr '\n' ',' | sed 's/,$//')

REQ_ENV="STRIPE_SECRET_KEY NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY STRIPE_BOOST_ME_DAILY_ID STRIPE_PRO_WEEKLY_ID STRIPE_VIP_MONTHLY_ID STRIPE_ELITE_YEARLY_ID"
MISS=""
for V in $REQ_ENV; do
  HIT=$(grep -RIn "\b$V\b" . 2>/dev/null | wc -l | awk '{print $1}')
  [ "$HIT" -gt 0 ] || MISS="$MISS $V"
done

# prod check
BASE="${DITONA_BASE:-https://www.ditonachat.com}"
JSON="$(curl -fsS "$BASE/api/stripe/prices" || true)"
LEN=$(printf %s "$JSON" | wc -c | awk '{print $1}')

MODE="unknown"
[ "$HAS_BASIC" = "1" ] && MODE="stub_basic"
[ "$HAS_LIST_ALL" = "1" ] && MODE="list_all"
[ -n "$ENV_USED" ] && echo "$ENV_USED" | grep -q 'STRIPE_.*_ID' && MODE="env_ids"

echo "-- Acceptance --"
echo "ROUTE_FILE=${ROUTE:-none}"
echo "DETECTED_MODE=$MODE"
echo "ENV_VARS_USED=${ENV_USED:-none}"
echo "REQ_ENV_MISSING=${MISS:-none}"
echo "PROD_API_LEN=$LEN"
echo "PROD_API_SAMPLE=$(echo "$JSON" | tr -d '\n' | cut -c1-200)"
echo "-- End Acceptance --"
