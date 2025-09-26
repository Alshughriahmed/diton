#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/C1_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/api/rtc/matchmake/route.ts"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# dynamic="force-dynamic"
if grep -q 'export\s\+const\s\+dynamic' "$F"; then
  perl -0777 -pe 's/export\s+const\s+dynamic\s*=\s*["'\''][^"'\'']+["'\''];/export const dynamic = "force-dynamic";/g' -i "$F"
else
  sed -i '1i export const dynamic = "force-dynamic";' "$F"
fi

echo "-- Acceptance --"
echo "MATCHMAKE_DYNAMIC_OK=$([ "$(grep -c 'dynamic\s*=\s*"force-dynamic"' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "MATCHMAKE_PEERID_PRESENT=$([ "$(grep -c 'peerAnonId' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
