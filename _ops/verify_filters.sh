#!/usr/bin/env bash
set -euo pipefail

echo "== Sync =="
git fetch origin
git checkout main
git pull --rebase origin main

echo "== Scan =="
LEGACY=$(rg -n --no-heading -e 'RemoteTopRight|CountrySelect|GenderSelect' src || true)
FILTERBAR=$(rg -n --no-heading -e '(<\s*FilterBar\b|from .*/FilterBar)' src || true)

echo "-- Legacy refs --"
echo "${LEGACY:-NONE}"
echo "-- FilterBar refs --"
echo "${FILTERBAR:-NONE}"

if [[ -n "${LEGACY}" ]]; then
  echo "!! FOUND legacy refs above. Replace with <FilterBar /> in those files."
  exit 2
fi

echo "== Build =="
npm run -s build || pnpm -s build || yarn -s build

echo "== RTC smoke =="
bash _ops/acc_rtc.sh https://www.ditonachat.com || true

echo "== Done =="
