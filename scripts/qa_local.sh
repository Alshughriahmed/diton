#!/usr/bin/env bash
set -Eeuo pipefail
export TERM=dumb
ROOT="/home/runner/workspace"; cd "$ROOT" || exit 2

CT="src/app/chat/components/ChatToolbar.tsx"
FB="src/app/chat/components/FilterBar.tsx"
BC="src/components/chat/BeautyControls.tsx"
LIKE="src/components/chat/LikeSystem.tsx"
RTC="src/app/chat/rtcFlow.ts"
RESP="src/app/chat/dcMetaResponder.client.ts"
ADAPTER="src/app/chat/safeFetch.ts"
MW="src/middleware.ts"
ALLOW="src/app/api/message/allow/route.ts"
STATUS="src/app/api/_status/route.ts"
APID="src/app/api"

AUTO_NEXT_PRESENT=0
grep -q "AUTO_NEXT: fired" "$RTC" && AUTO_NEXT_PRESENT=1 || true

DC_OPEN_PRESENT=0
grep -q "datachannel-open" "$RTC" && grep -q "dc-open" "$RTC" && DC_OPEN_PRESENT=1 || true

P0=0; P300=0; P1200=0
grep -R "meta:init" "$RTC" "$RESP" | grep -vq setTimeout && P0=1 || true
grep -R "setTimeout" "$RTC" "$RESP" | grep -q "300" && P300=1 || true
grep -R "setTimeout" "$RTC" "$RESP" | grep -q "1200" && P1200=1 || true

G_PREV=0; G_FILT=0; G_BEAU=0
[ -f "$CT" ] && grep -qE "ffa|dc\.open|pairId" "$CT" && G_PREV=1 || true
[ -f "$FB" ] && grep -qE "ffa|dc\.open" "$FB" && G_FILT=1 || true
[ -f "$BC" ] && grep -qE "ffa|vip" "$BC" && G_BEAU=1 || true
GATING_OK=$([ $G_PREV -eq 1 ] && [ $G_FILT -eq 1 ] && [ $G_BEAU -eq 1 ] && echo 1 || echo 0)

ADAPTER_EXISTS=0; LIKE_USES_SAFE=0
[ -f "$ADAPTER" ] && ADAPTER_EXISTS=1
[ -f "$LIKE" ] && grep -q "safeFetch" "$LIKE" && LIKE_USES_SAFE=1 || true

MW_EXCLUDES_API=0
[ -f "$MW" ] && grep -q "matcher" "$MW" && grep -q "api" "$MW" && MW_EXCLUDES_API=1 || true

API_DYNAMIC=0; API_NOSTORE_LITERAL=0; API_CACHE_BYPASS=0
[ -d "$APID" ] && {
  grep -RInq "export const dynamic" "$APID" && API_DYNAMIC=1 || true
  grep -RInq "no-store|Cache-Control" "$APID" && API_NOSTORE_LITERAL=1 || true
  ([ $API_DYNAMIC -eq 1 ] || [ $API_NOSTORE_LITERAL -eq 1 ]) && API_CACHE_BYPASS=1 || true
} || true

ALLOW_FAST=0
[ -f "$ALLOW" ] && grep -q "FREE_FOR_ALL" "$ALLOW" && ALLOW_FAST=1 || true

STATUS_PRESENT=0
[ -f "$STATUS" ] && STATUS_PRESENT=1 || true

set +e
pnpm -s build >/dev/null 2>&1
RC=$?
set -e

FEATURES_OK=1
for v in $AUTO_NEXT_PRESENT $DC_OPEN_PRESENT $P0 $P300 $P1200 $GATING_OK $ADAPTER_EXISTS $LIKE_USES_SAFE $MW_EXCLUDES_API $API_CACHE_BYPASS $ALLOW_FAST $STATUS_PRESENT; do
  [ "$v" = "1" ] || { FEATURES_OK=0; break; }
done

echo "-- Acceptance --"
echo "STEP=QA_LOCAL"
echo "BUILD=$( [ $RC -eq 0 ] && echo OK || echo FAIL )"
echo "FEATURES_OK=$FEATURES_OK"
echo "-- /Acceptance --"

[ "$RC" -eq 0 ] && [ "$FEATURES_OK" -eq 1 ]
