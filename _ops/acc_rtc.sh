#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-https://www.ditonachat.com}"
say(){ printf "\n== %s ==\n" "$*"; }
code(){ curl -s -o /dev/null -w "%{http_code}" "$@"; }
json(){ curl -s "$@"; }
TMPDIR="${TMPDIR:-/tmp}"
JAR_A="$TMPDIR/ditona_anon_A.jar"; JAR_B="$TMPDIR/ditona_anon_B.jar"
rm -f "$JAR_A" "$JAR_B"

say "1) Init anon cookies"
curl -s -c "$JAR_A" "$BASE/api/anon/init" >/dev/null
curl -s -c "$JAR_B" "$BASE/api/anon/init" >/dev/null

say "2) Queue mode"
MODE=$(curl -s "$BASE/api/rtc/qlen" | sed -n 's/.*"mode":"\([^"]\+\)".*/\1/p'); echo "MODE=$MODE"

say "3) Enqueue A/B"
code -b "$JAR_A" -H "content-type: application/json" -X POST -d '{"gender":"u","country":"US","filterGenders":"all","filterCountries":"ALL"}' "$BASE/api/rtc/enqueue" | xargs echo "A enqueue:"
code -b "$JAR_B" -H "content-type: application/json" -X POST -d '{"gender":"u","country":"US","filterGenders":"all","filterCountries":"ALL"}' "$BASE/api/rtc/enqueue" | xargs echo "B enqueue:"

say "4) Matchmake"
R_A=$(curl -s -b "$JAR_A" -X POST "$BASE/api/rtc/matchmake"); echo "A: $R_A"
PAIR=$(echo "$R_A" | sed -n 's/.*"pairId":"\([^"]\+\)".*/\1/p'); ROLE_A=$(echo "$R_A" | sed -n 's/.*"role":"\([^"]\+\)".*/\1/p')
R_B=$(curl -s -b "$JAR_B" -X POST "$BASE/api/rtc/matchmake"); echo "B: $R_B"
PAIR_B=$(echo "$R_B" | sed -n 's/.*"pairId":"\([^"]\+\)".*/\1/p'); ROLE_B=$(echo "$R_B" | sed -n 's/.*"role":"\([^"]\+\)".*/\1/p')
echo "Expected: same pairId; roles caller/callee"
echo "Actual:   A:$PAIR ($ROLE_A)  B:$PAIR_B ($ROLE_B)"
test -n "$PAIR" && [ "$PAIR" = "$PAIR_B" ] || { echo "✗ Matchmake failed"; exit 1; }

say "5) Offer/Answer"
code -b "$JAR_A" -H "content-type: application/json" -X POST -d "{\"pairId\":\"$PAIR\",\"sdp\":\"v=0-dummy-offer\"}" "$BASE/api/rtc/offer" | xargs echo "A POST /offer:"
curl -s -b "$JAR_B" "$BASE/api/rtc/offer?pairId=$PAIR" | sed 's/.*/B GET \/offer: &/'
code -b "$JAR_B" -H "content-type: application/json" -X POST -d "{\"pairId\":\"$PAIR\",\"sdp\":\"v=0-dummy-answer\"}" "$BASE/api/rtc/answer" | xargs echo "B POST /answer:"
curl -s -b "$JAR_A" "$BASE/api/rtc/answer?pairId=$PAIR" | sed 's/.*/A GET \/answer: &/'

say "6) ICE exchange"
code -b "$JAR_A" -H "content-type: application/json" -X POST -d "{\"pairId\":\"$PAIR\",\"candidate\":{\"candidate\":\"candA\",\"sdpMid\":\"0\",\"sdpMLineIndex\":0}}" "$BASE/api/rtc/ice" | xargs echo "A POST /ice:"
curl -s -b "$JAR_B" "$BASE/api/rtc/ice?pairId=$PAIR" | sed 's/.*/B GET \/ice: &/'
code -b "$JAR_B" -H "content-type: application/json" -X POST -d "{\"pairId\":\"$PAIR\",\"candidate\":{\"candidate\":\"candB\",\"sdpMid\":\"0\",\"sdpMLineIndex\":0}}" "$BASE/api/rtc/ice" | xargs echo "B POST /ice:"
curl -s -b "$JAR_A" "$BASE/api/rtc/ice?pairId=$PAIR" | sed 's/.*/A GET \/ice: &/'

say "7) qlen (final)"
curl -s "$BASE/api/rtc/qlen" | sed 's/.*/qlen: &/'

say "SUMMARY"
echo "MODE=$MODE (memory during bring-up; expected 'redis' after env fix)"
echo "Match + SDP/ICE via REST OK if above steps succeeded."