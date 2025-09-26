#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-}"; [[ -z "$BASE" ]] && { echo "USAGE: bash s7e_run_preview.sh <PREVIEW_URL>"; exit 2; }
echo "-- S7e -- BASE=$BASE"
echo "[pre] health:"; curl -sS "$BASE/api/health"; echo
bash ./s7_dev_vip_check.sh "$BASE"
echo "-- End S7e --"
