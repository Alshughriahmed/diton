#!/usr/bin/env bash
set -euo pipefail
BASE="${DITONA_BASE:-https://www.ditonachat.com}"

PROV_JSON="$(curl -fsS "$BASE/api/auth/providers" || true)"
HAS_PROV=$([ -n "$PROV_JSON" ] && echo 1 || echo 0)

HEADERS="$(curl -fsSI "$BASE/api/auth/signin" || true)"
STATUS=$(echo "$HEADERS" | awk 'BEGIN{s=0} /^HTTP/{s=$2} END{print s}')
HAS_CSRF=$(echo "$HEADERS" | grep -qi 'set-cookie:.*next-auth\.csrf-token' && echo 1 || echo 0)

echo "-- Acceptance --"
echo "BASE=$BASE"
echo "PROD_PROVIDERS_OK=$HAS_PROV"
echo "PROD_SIGNIN_STATUS=${STATUS:-0}"
echo "PROD_SIGNIN_SETS_CSRF=$HAS_CSRF"
echo "PROVIDERS_JSON_SAMPLE=$(echo "$PROV_JSON" | tr -d '\n' | cut -c1-200)"
echo "-- End Acceptance --"
