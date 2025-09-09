#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:3000}"
JAR="$(mktemp)"

post(){ curl -s -o /dev/null -w "%{http_code}" -H 'content-type: application/json' -X POST -d "$1" "$BASE/api/match/next"; }

echo "[Non-VIP] gender[2] => $(post '{"gender":["male","female"]}')"     # expect 403
echo "[Non-VIP] countries[2] => $(post '{"countries":["FR","DE"]}')"     # expect 403
echo "[Non-VIP] countries[1]=FR => $(post '{"countries":["FR"]}')"       # expect 200 (أو 200 مع السماح الافتراضي)

# grant كوكي VIP (dev) ثم أعد الفحص
curl -s -H 'content-type: application/json' -X POST -c "$JAR" "$BASE/api/vip/dev/grant" >/dev/null
echo "[VIP] gender[2]   => $(curl -s -o /dev/null -w "%{http_code}" -H 'content-type: application/json' -X POST -b "$JAR" -d '{"gender":["male","female"]}' "$BASE/api/match/next")"    # 200
echo "[VIP] countries[15] => $(curl -s -o /dev/null -w "%{http_code}" -H 'content-type: application/json' -X POST -b "$JAR" -d '{"countries":["US","DE","FR","GB","TR","AE","SA","EG","ES","IT","NL","SE","JP","KR","IN"]}' "$BASE/api/match/next")" # 200