#!/usr/bin/env bash
set -euo pipefail
BASE="https://www.ditonachat.com"
J1=$(mktemp); J2=$(mktemp)
curl -s -c "$J1" -b "$J1" "$BASE/api/anon/init" >/dev/null
curl -s -c "$J2" -b "$J2" "$BASE/api/anon/init" >/dev/null
curl -s -o /dev/null -w "A_enqueue:%{http_code}\n" -c "$J1" -b "$J1" -H 'content-type: application/json' -d '{}' "$BASE/api/rtc/enqueue"
curl -s -o /dev/null -w "B_enqueue:%{http_code}\n" -c "$J2" -b "$J2" -H 'content-type: application/json' -d '{}' "$BASE/api/rtc/enqueue"
P1="";R1="";P2="";R2=""
for i in $(seq 1 20); do
  j1=$(curl -s -c "$J1" -b "$J1" -X POST "$BASE/api/rtc/matchmake")
  j2=$(curl -s -c "$J2" -b "$J2" -X POST "$BASE/api/rtc/matchmake")
  P1=$(echo "$j1"|jq -r '.pairId // empty'); R1=$(echo "$j1"|jq -r '.role // empty')
  P2=$(echo "$j2"|jq -r '.pairId // empty'); R2=$(echo "$j2"|jq -r '.role // empty')
  echo "tick $i => A:{pair:$P1 role:$R1} B:{pair:$P2 role:$R2}"
  [[ -n "$P1" && -n "$P2" ]] && break
  sleep 1
done
echo "RESULT => A:$R1 B:$R2 pair:$P1/$P2"
curl -s "$BASE/api/rtc/qlen"; echo
