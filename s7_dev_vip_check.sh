#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-}"; JAR="$(mktemp)"
[[ -z "$BASE" ]] && { echo "USAGE: bash s7_dev_vip_check.sh <PREVIEW_URL>"; exit 2; }

echo "-- S7d (dev VIP on Preview) --"
echo "BASE=$BASE"

echo "[0] vip-status (no cookie)"; curl -sS "$BASE/api/user/vip-status"; echo

echo "[1] grant (should be 200 on Preview, 403 on Prod)"
curl -sS -o /dev/null -w "HTTP=%{http_code}\n" -X POST -c "$JAR" "$BASE/api/user/vip/dev/grant"

echo "[2] vip-status (with cookie) — expect cookieVip:true"
curl -sS -b "$JAR" "$BASE/api/user/vip-status"; echo

echo "[3] revoke (should be 200)"
curl -sS -o /dev/null -w "HTTP=%{http_code}\n" -X POST -b "$JAR" "$BASE/api/user/vip/dev/revoke"

echo "[4] vip-status (after revoke) — expect cookieVip:false"
curl -sS -b "$JAR" "$BASE/api/user/vip-status"; echo
echo "-- End S7d --"
