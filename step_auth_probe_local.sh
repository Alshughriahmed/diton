#!/usr/bin/env bash
set -euo pipefail
TS="$(date +%Y%m%d-%H%M%S)"
OUT="_ops/reports/auth_probe_local_${TS}"; mkdir -p "$OUT"

RG="rg -n --no-messages"; command -v rg >/dev/null || RG="grep -RInE"

# مواقع الراوت المحتملة
AUTH_ROUTE_PATH="$($RG 'api/auth/\[\.\.\.nextauth\]' -g '!**/node_modules/**' src 2>/dev/null | awk -F: '{print $1}' | head -n1)"
[ -z "${AUTH_ROUTE_PATH:-}" ] && AUTH_ROUTE_PATH="$($RG '\[\.\.\.nextauth\]' -g '!**/node_modules/**' src 2>/dev/null | awk -F: '{print $1}' | head -n1)"

# مزوّدو NextAuth (من مسارات الاستيراد)
PROV_LINES="$($RG 'next-auth/providers/' -g '!**/node_modules/**' src 2>/dev/null || true)"
echo "$PROV_LINES" > "$OUT/providers_imports.txt"
PROVIDERS=$(echo "$PROV_LINES" | sed -E 's|.*providers/([^"'"'"']+).*|\1|g' | sort -u | tr '\n' ',' | sed 's/,$//')

# وجود useSession/getServerSession
USESESSION=$($RG 'useSession\(|getServerSession\(' src 2>/dev/null >/dev/null && echo 1 || echo 0)

# روابط تسجيل الدخول في الواجهة
SIGNIN_HITS="$($RG '/api/auth/signin' src 2>/dev/null || true)"
echo "$SIGNIN_HITS" > "$OUT/signin_refs.txt"
HAS_SIGNIN=$([ -s "$OUT/signin_refs.txt" ] && echo 1 || echo 0)

# متغيرات البيئة المطلوبة
REQ_VARS="NEXTAUTH_URL NEXTAUTH_SECRET GITHUB_ID GITHUB_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET AUTH_OKTA_ID AUTH_OKTA_SECRET"
ENV_FILES=$(ls -1 .env* 2>/dev/null || true; $RG -n 'NEXTAUTH_|_ID|_SECRET' -g '!**/node_modules/**' . 2>/dev/null | awk -F: '{print $1}' | sort -u)
echo "$ENV_FILES" > "$OUT/env_files.txt"

MISSING=""
for V in $REQ_VARS; do
  HIT=$($RG -n "\b$V\b" . 2>/dev/null | wc -l | awk '{print $1}')
  [ "$HIT" -gt 0 ] || MISSING="$MISSING $V"
done

# طباعة
echo "-- Acceptance --"
echo "AUTH_ROUTE_PRESENT=$([ -n "${AUTH_ROUTE_PATH:-}" ] && echo 1 || echo 0)"
echo "AUTH_ROUTE_FILE=${AUTH_ROUTE_PATH:-none}"
echo "PROVIDERS=${PROVIDERS:-none}"
echo "UI_HAS_SIGNIN_LINKS=$HAS_SIGNIN"
echo "USES_SESSION_API=$USESESSION"
echo "ENV_FILES_LISTED=$([ -s "$OUT/env_files.txt" ] && echo 1 || echo 0)"
echo "ENV_VARS_MISSING=${MISSING:-none}"
echo "ARTIFACTS_DIR=$OUT"
echo "-- End Acceptance --"
