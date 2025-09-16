#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"
TS="$(date -u +%Y%m%d-%H%M%S)"
RPT="_ops/reports/post_deploy_${TS}.log"
mkdir -p _ops/reports
exec > >(tee -a "$RPT") 2>&1
echo "BASE=$BASE"

# (A) Stripe prices EUR sanity
PR="$(curl -sS "$BASE/api/stripe/prices" || echo "{}")"
E1=$(grep -c '"amount":149' <<<"$PR" || true); E2=$(grep -c '"amount":599'  <<<"$PR" || true)
E3=$(grep -c '"amount":1699'<<<"$PR" || true); E4=$(grep -c '"amount":9999' <<<"$PR" || true)
EC=$(grep -c '"currency":"eur"' <<<"$PR" || true)
PRICES_OK=$([ $E1 -gt 0 ] && [ $E2 -gt 0 ] && [ $E3 -gt 0 ] && [ $E4 -gt 0 ] && [ $EC -gt 3 ] && echo 1 || echo 0)

# (B) Subscribe (غير مصدّق) => 401 + headers
HDR="$(curl -sSI -X POST -H 'content-type: application/json' -d '{"plan":"daily"}' "$BASE/api/stripe/subscribe" | tr -d '\r')"
SUB_CODE="$(awk 'NR==1{print $2}' <<<"$HDR")"
HAS_NOSTORE=$(grep -qi 'cache-control:.*no-store'   <<<"$HDR" && echo 1 || echo 0)
HAS_REF=$(grep -qi 'referrer-policy:.*no-referrer' <<<"$HDR" && echo 1 || echo 0)
SUB_401=$([ "$SUB_CODE" = "401" ] && echo 1 || echo 0)

# (C) Like API smoke
uuid(){ command -v uuidgen >/dev/null && uuidgen || cat /proc/sys/kernel/random/uuid; }
PAIR=$(uuid); A=$(uuid); B=$(uuid)
curl -sS -XPOST "$BASE/api/like?pairId=$PAIR&op=inc" -H "x-anon: $A" >/dev/null || true
curl -sS -XPOST "$BASE/api/like?pairId=$PAIR&op=inc" -H "x-anon: $A" >/dev/null || true
curl -sS -XPOST "$BASE/api/like?pairId=$PAIR&op=inc" -H "x-anon: $B" >/dev/null || true
GA="$(curl -sS "$BASE/api/like?pairId=$PAIR" -H "x-anon: $A" || echo "{}")"
GB="$(curl -sS "$BASE/api/like?pairId=$PAIR" -H "x-anon: $B" || echo "{}")"
cA="$(sed -n 's/.*"count":\([0-9][0-9]*\).*/\1/p' <<<"$GA" | head -1)"
cB="$(sed -n 's/.*"count":\([0-9][0-9]*\).*/\1/p' <<<"$GB" | head -1)"
youB="$(sed -n 's/.*"you":\([a-z]*\).*/\1/p' <<<"$GB" | head -1)"
LIKE_OK=$([ "$cA" = "2" ] && [ "$cB" = "1" ] && { [ "$youB" = "true" ] || [ "$youB" = "false" ]; } && echo 1 || echo 0)

# (D) RTC mini E2E
JA=/tmp/a.jar; JB=/tmp/b.jar; JX=/tmp/x.jar
curl -sSc "$JA" "$BASE/api/anon/init" >/dev/null || true
curl -sSc "$JB" "$BASE/api/anon/init" >/dev/null || true
curl -sSc "$JX" "$BASE/api/anon/init" >/dev/null || true
BODY='{"gender":"u","country":"US","filterGenders":"all","filterCountries":"ALL"}'
EA=$(curl -sS -w '%{http_code}' -o /dev/null -XPOST -H 'content-type: application/json' -b "$JA" -d "$BODY" "$BASE/api/rtc/enqueue" || echo 000)
EB=$(curl -sS -w '%{http_code}' -o /dev/null -XPOST -H 'content-type: application/json' -b "$JB" -d "$BODY" "$BASE/api/rtc/enqueue" || echo 000)
EX=$(curl -sS -w '%{http_code}' -o /dev/null -XPOST -H 'content-type: application/json' -b "$JX" -d "$BODY" "$BASE/api/rtc/enqueue" || echo 000)
MM="$(curl -sSb "$JX" -XPOST "$BASE/api/rtc/matchmake" || echo '{}')"
PID="$(sed -n 's/.*"pairId":"\([^"]*\)".*/\1/p' <<<"$MM" | head -1)"
RTC_OK=$([ "$EA" = "204" ] && [ "$EB" = "204" ] && [ "$EX" = "204" ] && [ -n "$PID" ] && echo 1 || echo 0)

echo "-- Acceptance --"
echo "PRICES_OK=$PRICES_OK"
echo "SUB_401=$SUB_401"
echo "HAS_NOSTORE=$HAS_NOSTORE"
echo "HAS_REFERRER=$HAS_REF"
echo "LIKE_OK=$LIKE_OK"
echo "RTC_OK=$RTC_OK"
echo "REPORT=$RPT"
