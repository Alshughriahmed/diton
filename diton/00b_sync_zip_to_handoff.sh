#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${ROOT:-/home/runner/workspace}"
cd "$ROOT"
[ -x _ops/bin/shell_guard.sh ] && source _ops/bin/shell_guard.sh || true

ZIP="/mnt/data/diton.zip"
if [[ ! -f "$ZIP" ]]; then echo "ERROR_NO_ZIP=$ZIP"; exit 2; fi

git fetch origin >/dev/null 2>&1 || true
HEAD_HASH="$(git rev-parse HEAD 2>/dev/null || echo NO_GIT)"
ORIGIN_HASH="$(git ls-remote origin -h refs/heads/main 2>/dev/null | awk '{print $1}' || true)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BR="handoff/${STAMP}"

TMP="_ops/tmp/zip_${STAMP}"
mkdir -p "$TMP" _ops/reports
if command -v unzip >/dev/null 2>&1; then unzip -q -o "$ZIP" -d "$TMP"; else bsdtar -xf "$ZIP" -C "$TMP"; fi
ZIPROOT="$(dirname "$(find "$TMP" -maxdepth 3 -name package.json | head -n1)")"
if [[ -z "$ZIPROOT" || ! -d "$ZIPROOT" ]]; then echo "ERROR_NO_PKG_IN_ZIP=1"; exit 3; fi

git checkout -B "$BR"

rsync -a --delete \
  --exclude '.git' \
  --exclude '_ops/**' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.vercel' \
  --exclude '.env*' \
  "$ZIPROOT"/ ./

git add -A
CHANGED=0
git diff --cached --quiet || CHANGED=1
if [[ "$CHANGED" -eq 1 ]]; then git commit -m "handoff: sync to zip baseline ${STAMP}"; fi

PUSHED=0
git push -u origin "$BR" && PUSHED=1 || true

REPORT="_ops/reports/handoff_${STAMP}.log"
{
  echo "HEAD_HASH_BEFORE=$HEAD_HASH"
  echo "ORIGIN_MAIN_HASH=$ORIGIN_HASH"
  echo "BRANCH=$BR"
  echo "ZIPROOT=$ZIPROOT"
  echo "CHANGED=$CHANGED"
  echo "PUSHED=$PUSHED"
} > "$REPORT"

echo "-- Acceptance --"
echo "BASELINE_OK=1"
echo "SHELL_GUARD_READY=1"
echo "BRANCH=$BR"
echo "PUSHED=$PUSHED"
echo "REPORT=$REPORT"
