#!/usr/bin/env bash
set -Eeuo pipefail
TS="$(date +%Y%m%d-%H%M%S)"; OUT="_ops/reports/auth_code_${TS}"; mkdir -p "$OUT"
RG="rg -n --no-messages"; command -v rg >/dev/null || RG="grep -RInE"

AUTH_ROUTE="$($RG 'app/api/auth/\[\.\.\.nextauth\]/route\.(t|j)s' -g '!**/node_modules/**' src 2>/dev/null | head -n1 | awk -F: '{print $1}')"
[ -n "${AUTH_ROUTE:-}" ] && sed -n '1,180p' "$AUTH_ROUTE" > "$OUT/route_head.txt" || true

PROV_IMP="$($RG 'next-auth/providers/' -g '!**/node_modules/**' src 2>/dev/null || true)"
PROVIDERS="$(echo "$PROV_IMP" | sed -E 's|.*providers/([^"'"'"']+).*|\1|g' | sort -u | tr '\n' ',' | sed 's/,$//')"
HAS_GOOGLE=$($RG 'providers/google' -g '!**/node_modules/**' src >/dev/null 2>&1 && echo 1 || echo 0)
HAS_CREDENTIALS=$($RG 'providers/credentials' -g '!**/node_modules/**' src >/dev/null 2>&1 && echo 1 || echo 0)
HAS_EMAIL=$($RG 'providers/email' -g '!**/node_modules/**' src >/dev/null 2>&1 && echo 1 || echo 0)
HAS_ADAPTER=$($RG 'adapter:' -g '!**/node_modules/**' src >/dev/null 2>&1 && echo 1 || echo 0)
HAS_NEXTAUTH_OPTS=$($RG 'NextAuthOptions|authOptions' -g '!**/node_modules/**' src >/dev/null 2>&1 && echo 1 || echo 0)

NEXTAUTH_VER="$(grep -oE '"'"'next-auth'"'"':[[:space:]]*'"'"'[^"'"'"']+'"'"' package.json 2>/dev/null | sed -E 's/.*"next-auth":[[:space:]]*"([^"]+)".*/\1/' | head -n1)"
[ -z "${NEXTAUTH_VER:-}" ] && NEXTAUTH_VER="unknown"

# بيئة متوقعة بحسب المزوّدات
REQ="NEXTAUTH_URL NEXTAUTH_SECRET"
[ "$HAS_GOOGLE" = "1" ] && REQ="$REQ GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET"
[ "$HAS_EMAIL" = "1" ] && REQ="$REQ EMAIL_SERVER EMAIL_FROM"
MISS=""
for V in $REQ; do
  HIT=$($RG "\b$V\b" -g '!**/node_modules/**' . 2>/dev/null | wc -l | awk '{print $1}')
  [ "$HIT" -gt 0 ] || MISS="$MISS $V"
done

echo "-- Acceptance --"
echo "AUTH_ROUTE_PRESENT=$([ -n "${AUTH_ROUTE:-}" ] && echo 1 || echo 0)"
echo "AUTH_ROUTE_FILE=${AUTH_ROUTE:-none}"
echo "PROVIDERS_LIST=${PROVIDERS:-none}"
echo "HAS_GOOGLE=$HAS_GOOGLE"
echo "HAS_CREDENTIALS=$HAS_CREDENTIALS"
echo "HAS_EMAIL=$HAS_EMAIL"
echo "HAS_ADAPTER=$HAS_ADAPTER"
echo "HAS_NEXTAUTH_OPTIONS=$HAS_NEXTAUTH_OPTS"
echo "NEXTAUTH_VERSION=$NEXTAUTH_VER"
echo "ENV_VARS_MISSING=${MISS:-none}"
echo "ARTIFACTS_DIR=$OUT"
echo "-- End Acceptance --"
