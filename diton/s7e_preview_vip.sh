#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-}"; JAR="$(mktemp)"
[[ -z "${BASE}" ]] && { echo "USAGE: bash s7e_preview_vip.sh <PREVIEW_URL>"; exit 2; }

echo "-- S7e @ $BASE --"
echo "[A] root:";           curl -sS -o /dev/null -w "HTTP=%{http_code}\n" "$BASE/"
echo "[B] /api/health:";    curl -sS "$BASE/api/health"; echo
echo "[C] vip-status:";     curl -sS "$BASE/api/user/vip-status"; echo

echo "[D] grant (Preview=200, Prod=403):"
curl -sS -o /dev/null -w "HTTP=%{http_code}\n" -X POST -c "$JAR" "$BASE/api/user/vip/dev/grant"

echo "[E] vip-status (with cookie):"
curl -sS -b "$JAR" "$BASE/api/user/vip-status"; echo

echo "[F] revoke (200 expected):"
curl -sS -o /dev/null -w "HTTP=%{http_code}\n" -X POST -b "$JAR" "$BASE/api/user/vip/dev/revoke"

echo "[G] vip-status (after revoke):"
curl -sS -b "$JAR" "$BASE/api/user/vip-status"; echo
echo "-- End S7e --"
