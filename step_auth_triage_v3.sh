#!/usr/bin/env bash
set -Eeuo pipefail
TS="$(date +%Y%m%d-%H%M%S)"
OUT="_ops/reports/auth_triage_${TS}"; mkdir -p "$OUT"
RG="rg -n --no-messages"; command -v rg >/dev/null || RG="grep -RInE"

AUTH_ROUTE="$($RG 'app/api/auth/\[\.\.\.nextauth\]/route\.ts|pages/api/auth/\[\.\.\.nextauth\]\.ts' -g '!**/node_modules/**' src 2>/dev/null | awk -F: '{print $1}' | head -n1)"
PROV_IMP="$($RG 'next-auth/providers/' -g '!**/node_modules/**' src 2>/dev/null || true)"
PROVIDERS="$(echo "$PROV_IMP" | sed -E 's|.*providers/([^"'"'"']+).*|\1|g' | sort -u | tr '\n' ',' | sed 's/,$//')"
PROV_COUNT=$( [ -n "${PROVIDERS:-}" ] && echo "$PROVIDERS" | tr ',' '\n' | sed '/^$/d' | wc -l | awk '{print $1}' || echo 0 )
HAS_NEXTAUTH_OPTS=$($RG 'NextAuthOptions|authOptions' -g '!**/node_modules/**' src 2>/dev/null >/dev/null && echo 1 || echo 0)
USES_SESSION=$($RG 'useSession\(|getServerSession\(' -g '!**/node_modules/**' src 2>/dev/null >/dev/null && echo 1 || echo 0)
HAS_SIGNIN_LINKS=$($RG '/api/auth/signin' -g '!**/node_modules/**' src 2>/dev/null >/dev/null && echo 1 || echo 0)
NEXTAUTH_VER="$(grep -oE '"'"'next-auth'"'"':[[:space:]]*'"'"'[^"'"'"']+'"'"' package.json 2>/dev/null | head -n1 | sed -E 's/.*"next-auth":[[:space:]]*"([^"]+)".*/\1/')"
[ -z "${NEXTAUTH_VER:-}" ] && NEXTAUTH_VER="unknown"

REQ_VARS="NEXTAUTH_URL NEXTAUTH_SECRET GITHUB_ID GITHUB_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET EMAIL_SERVER EMAIL_FROM"
MISS=""
for V in $REQ_VARS; do
  HIT=$($RG "\b$V\b" -g '!**/node_modules/**' . 2>/dev/null | wc -l | awk '{print $1}')
  [ "$HIT" -gt 0 ] || MISS="$MISS $V"
done

BASE="${DITONA_BASE:-https://www.ditonachat.com}"
PROV_JSON="$(curl -fsS "$BASE/api/auth/providers" || true)"
HAS_PROV=$([ -n "$PROV_JSON" ] && echo 1 || echo 0)
CSRF_JSON="$(curl -fsS "$BASE/api/auth/csrf" || true)"
HAS_CSRF_JSON=$([ -n "$CSRF_JSON" ] && echo 1 || echo 0)
HEADERS="$(curl -fsSI "$BASE/api/auth/signin" || true)"
STATUS=$(echo "$HEADERS" | awk 'BEGIN{s=0} /^HTTP/{s=$2} END{print s}')
SETS_CSRF_COOKIE=$(echo "$HEADERS" | grep -qi 'set-cookie:.*next-auth\.csrf-token' && echo 1 || echo 0)

echo "$PROV_IMP" > "$OUT/providers_imports.txt"
echo "$PROV_JSON" > "$OUT/prod_providers.json"
echo "$CSRF_JSON" > "$OUT/prod_csrf.json"
echo "$HEADERS"   > "$OUT/prod_signin_headers.txt"

echo "-- Acceptance --"
echo "AUTH_ROUTE_PRESENT=$([ -n "${AUTH_ROUTE:-}" ] && echo 1 || echo 0)"
echo "AUTH_ROUTE_FILE=${AUTH_ROUTE:-none}"
echo "NEXTAUTH_VERSION=$NEXTAUTH_VER"
echo "PROVIDERS_LIST=${PROVIDERS:-none}"
echo "PROVIDERS_COUNT=$PROV_COUNT"
echo "HAS_NEXTAUTH_OPTIONS=$HAS_NEXTAUTH_OPTS"
echo "USES_SESSION_APIS=$USES_SESSION"
echo "UI_HAS_SIGNIN_LINKS=$HAS_SIGNIN_LINKS"
echo "ENV_VARS_MISSING=${MISS:-none}"
echo "BASE=$BASE"
echo "PROD_PROVIDERS_OK=$HAS_PROV"
echo "PROD_CSRF_JSON=$HAS_CSRF_JSON"
echo "PROD_SIGNIN_STATUS=${STATUS:-0}"
echo "PROD_SET_CSRF_COOKIE=$SETS_CSRF_COOKIE"
echo "ARTIFACTS_DIR=$OUT"
echo "-- End Acceptance --"
