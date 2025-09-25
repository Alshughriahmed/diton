#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"
# التقط أول 5 ملفات JS من الصفحة
JS=$(curl -s "$BASE/" | grep -o '/_next/static/chunks/[^"]\+\.js' | head -n 5 | sort -u)
echo "# scanning ${BASE} bundles"
found=0
for f in $JS; do
  body="$(curl -s "$BASE$f" || true)"
  echo ">> scan $f"
  echo "$body" | grep -o 'ui:next' && found=1 || true
  echo "$body" | grep -o 'ui:prev' && found=1 || true
done
echo "FOUND_UI_EVENTS=$found"
