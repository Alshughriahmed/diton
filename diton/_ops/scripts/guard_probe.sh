#!/usr/bin/env bash
set -euo pipefail
BASE="https://www.ditonachat.com"
J1=$(mktemp); J2=$(mktemp)
curl -s -c "$J1" -b "$J1" "$BASE/api/anon/init" >/dev/null
curl -s -c "$J2" -b "$J2" "$BASE/api/anon/init" >/dev/null
curl -s -c "$J1" -b "$J1" -H 'content-type: application/json' -d '{}' "$BASE/api/rtc/enqueue" >/dev/null
curl -s -c "$J2" -b "$J2" -H 'content-type: application/json' -d '{}' "$BASE/api/rtc/enqueue" >/dev/null
for i in $(seq 1 20); do
  j1=$(curl -s -c "$J1" -b "$J1" -X POST "$BASE/api/rtc/matchmake")
  j2=$(curl -s -c "$J2" -b "$J2" -X POST "$BASE/api/rtc/matchmake")
  P1=$(echo "$j1"|jq -r '.pairId // empty'); R1=$(echo "$j1"|jq -r '.role // empty')
  P2=$(echo "$j2"|jq -r '.pairId // empty'); R2=$(echo "$j2"|jq -r '.role // empty')
  [[ -n "$P1" && -n "$P2" ]] && break; sleep 1
done
echo "roles: A:$R1 B:$R2 pair:$P1"
if [[ "$R1" == "callee" ]]; then
  echo -n "callee->POST offer should 403: "
  curl -s -o /dev/null -w "HTTP:%{http_code}\n" -c "$J1" -b "$J1" -H 'content-type: application/json' -d '{"sdp":"x","type":"offer"}' "$BASE/api/rtc/offer"
else
  echo -n "caller->GET offer should 403: "
  curl -s -o /dev/null -w "HTTP:%{http_code}\n" -c "$J1" -b "$J1" "$BASE/api/rtc/offer"
fi
echo -n "random session -> /api/rtc/answer should 403: "
J3=$(mktemp); curl -s -c "$J3" -b "$J3" "$BASE/api/anon/init" >/dev/null
curl -s -o /dev/null -w "HTTP:%{http_code}\n" -c "$J3" -b "$J3" "$BASE/api/rtc/answer"
