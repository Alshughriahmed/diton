#!/usr/bin/env bash
set -Eeuo pipefail
export TERM=dumb
ROOT="/home/runner/workspace"; cd "$ROOT" || exit 2
bash -lc '
set -Eeuo pipefail
export TERM=dumb
APID="src/app/api"; MW="src/middleware.ts"
MW_OK=0; [ -f "$MW" ] && grep -q "matcher" "$MW" && grep -q "api" "$MW" && MW_OK=1 || true
API_DYNAMIC=0; API_NOSTORE_LITERAL=0; API_CACHE_BYPASS=0
[ -d "$APID" ] && {
  grep -RInq "export const dynamic" "$APID" && API_DYNAMIC=1 || true
  grep -RInq "no-store|Cache-Control" "$APID" && API_NOSTORE_LITERAL=1 || true
  ([ $API_DYNAMIC -eq 1 ] || [ $API_NOSTORE_LITERAL -eq 1 ]) && API_CACHE_BYPASS=1 || true
} || true
echo "-- Acceptance --"
echo "STEP=DIAG_FULL_V2"
echo "MW_EXCLUDES_API=$MW_OK"
echo "API_DYNAMIC_PRESENT=$API_DYNAMIC"
echo "API_NOSTORE_LITERAL=$API_NOSTORE_LITERAL"
echo "API_CACHE_BYPASS=$API_CACHE_BYPASS"
echo "-- /Acceptance --"
'
