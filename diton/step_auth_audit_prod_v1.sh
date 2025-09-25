#!/usr/bin/env bash
set -Eeuo pipefail
BASE="${DITONA_BASE:-https://www.ditonachat.com}"
# مزوّدات
PROV_JSON="$(curl -fsS "$BASE/api/auth/providers" || true)"
# CSRF JSON
CSRF_JSON="$(curl -fsS "$BASE/api/auth/csrf" || true)"
# صفحة signin رؤوس فقط
HEADERS="$(curl -fsSI "$BASE/api/auth/signin" || true)"
STATUS=$(echo "$HEADERS" | awk 'BEGIN{s=0} /^HTTP/{s=$2} END{print s}')
SETS_CSRF=$(echo "$HEADERS" | grep -qi 'set-cookie:.*next-auth\.csrf-token' && echo 1 || echo 0)

# جلسة بدون كوكي (يجب أن تعود null أو 200)
SESSION_JSON="$(curl -fsS "$BASE/api/auth/session" || true)"

echo "-- Acceptance --"
echo "BASE=$BASE"
echo "PROD_PROVIDERS_JSON_LEN=$(printf %s "$PROV_JSON" | wc -c | awk '{print $1}')"
echo "PROD_CSRF_JSON_LEN=$(printf %s "$CSRF_JSON" | wc -c | awk '{print $1}')"
echo "PROD_SIGNIN_STATUS=${STATUS:-0}"
echo "PROD_SIGNIN_SETS_CSRF=$SETS_CSRF"
echo "PROD_SESSION_JSON_LEN=$(printf %s "$SESSION_JSON" | wc -c | awk '{print $1}')"
echo "PROVIDERS_JSON_SAMPLE=$(echo "$PROV_JSON" | tr -d '\n' | cut -c1-200)"
echo "-- End Acceptance --"
