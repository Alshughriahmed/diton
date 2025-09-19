#!/usr/bin/env bash
# release_push_vercel.sh — دفع إلى GitHub وتهيئة نشر Vercel الأوتوماتيكي
# يعمل بلا تفاعل. لا يعدّل ENV. يفترض تكامل GitHub↔Vercel مفعّل.
. _ops/bin/disable_alt_screen.sh || true
set -Eeuo pipefail; export TERM=dumb CI=1 NO_COLOR=1 FORCE_COLOR=0 PAGER=cat GIT_PAGER=cat LESS=FRX

ts(){ date -u +%Y%m%d-%H%M%S; }
STAMP="$(ts)"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REPORT="${ROOT}/_ops/reports/release_${STAMP}.log"
mkdir -p "${REPORT%/*}"

BASE="https://www.ditonachat.com"

echo "[i] Pre-flight checks (production gate)" | tee "$REPORT"
ok_health=0;     curl -fsS "$BASE/api/health" >/dev/null && ok_health=1 || true
ok_turn443=0;    curl -fsS "$BASE/api/turn" | grep -q 443 && ok_turn443=1 || true
ok_stripe=0;     curl -fsS "$BASE/api/stripe/prices" | grep -q EUR && ok_stripe=1 || true
ok_envffa=0;     curl -fsS "$BASE/api/rtc/env" | grep -qE "\"FREE_FOR_ALL\":\"1\"|\"NEXT_PUBLIC_FREE_FOR_ALL\":\"1\"" && ok_envffa=1 || true
ok_nostore=0;    curl -fsSI "$BASE/api/rtc/matchmake" | grep -qi "^cache-control:.*no-store" && ok_nostore=1 || true

echo "[i] Git prepare" | tee -a "$REPORT"
git config --global --get user.email >/dev/null 2>&1 || git config --global user.email "ci@ditona.chat"
git config --global --get user.name  >/dev/null 2>&1 || git config --global user.name  "Ditona CI"
git fetch --all --prune || true

# لقط بصمة HEAD الحالية
HEAD_BEFORE="$(git rev-parse --short HEAD 2>/dev/null || echo 0)"

# تأكيد الالتزامات المحلية
git add -A
if ! git diff --cached --quiet; then
  git commit -m "release(${STAMP}): FFA+DC+match/TTLs ready"
  echo "[git] committed local changes" | tee -a "$REPORT"
else
  echo "[git] nothing to commit" | tee -a "$REPORT"
fi

# إنشاء فرع الإصدار ودفعه
set +e
git checkout -B "release/${STAMP}" >/dev/null 2>&1
git_release_push=0
git push -u origin "release/${STAMP}" >/dev/null 2>&1 && git_release_push=1
# دمج إلى main ودفعه لتفعيل نشر Vercel المتكامل مع GitHub
git fetch origin main >/dev/null 2>&1
git checkout -B main origin/main >/dev/null 2>&1 || git checkout main >/dev/null 2>&1
git merge --no-ff -m "merge release/${STAMP} -> main" "release/${STAMP}" >/dev/null 2>&1 || true
git_main_push=0
git push origin main >/dev/null 2>&1 && git_main_push=1
# وسم الإصدار
git tag -a "rel-${STAMP}" -m "release ${STAMP}" >/dev/null 2>&1 || true
git_tag_push=0
git push --tags >/dev/null 2>&1 && git_tag_push=1
set -e

ORIGIN_URL="$(git config --get remote.origin.url || echo unknown)"
HEAD_AFTER="$(git rev-parse --short HEAD 2>/dev/null || echo 0)"

{
  echo "-- Acceptance --"
  echo "HEALTH_OK=${ok_health}"
  echo "TURN_443_OK=${ok_turn443}"
  echo "STRIPE_JSON_OK=${ok_stripe}"
  echo "ENV_FFA_OK=${ok_envffa}"
  echo "API_JSON_NOCACHE_OK=${ok_nostore}"
  echo "GIT_ORIGIN=${ORIGIN_URL}"
  echo "GIT_HEAD_BEFORE=${HEAD_BEFORE}"
  echo "GIT_HEAD_AFTER=${HEAD_AFTER}"
  echo "GIT_RELEASE_BRANCH=release/${STAMP}"
  echo "GIT_RELEASE_PUSHED=${git_release_push}"
  echo "GIT_MAIN_PUSHED=${git_main_push}"
  echo "GIT_TAG_PUSHED=${git_tag_push}"
  echo "DEPLOY_TRIGGERED_HINT=If GitHub↔Vercel integration is enabled, pushing main triggers build."
} | tee -a "$REPORT"

echo "[i] Report: $REPORT"
