set -euo pipefail
export LANG=C LC_ALL=C TERM=dumb

: "${VERCEL_TOKEN:?export VERCEL_TOKEN=...}"

GIT_REMOTE="${GIT_REMOTE:-origin}"
REL="release/$(date -u +%Y%m%d-%H%M)"
VC="pnpm dlx vercel@latest --token $VERCEL_TOKEN"

# 1) build تحقُّق
pnpm -s build

# 2) Git: فرع+تاج+دفع
git fetch "$GIT_REMOTE" --tags || true
git checkout -B "$REL"
git add -A
git commit -m "release: auto $(date -u +%Y-%m-%dT%H:%MZ)" || true
git tag -f "v$(date -u +%Y%m%d-%H%M)"
git push -u "$GIT_REMOTE" "$REL" --tags

# 3) ربط مشروع Vercel أول مرة فقط
if [ ! -f .vercel/project.json ] && [ -n "${VERCEL_PROJECT:-}" ] && [ -n "${VERCEL_ORG_ID:-}" ]; then
  $VC link --yes --project "$VERCEL_PROJECT" --org "$VERCEL_ORG_ID"
fi

# 4) سحب إعدادات prod ثم نشر
$VC pull --yes --environment=production || true
DEPLOY_URL="$($VC deploy --prod --yes | tail -n1)"

# 5) alias اختياري
if [ -n "${VERCEL_DOMAIN:-}" ]; then
  $VC alias set "$DEPLOY_URL" "$VERCEL_DOMAIN"
fi

# 6) تقرير
echo "-- Acceptance --"
echo "GIT_PUSHED=1"
echo "RELEASE_BRANCH=$REL"
echo "DEPLOY_URL=$DEPLOY_URL"
echo "ALIAS_SET=$([ -n "${VERCEL_DOMAIN:-}" ] && echo 1 || echo 0)"
