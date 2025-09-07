#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"
curl -s -X POST -c /tmp/age.ok "$BASE/api/age/allow" >/dev/null
pp=$(curl -sI -b /tmp/age.ok "$BASE/chat" | awk 'BEGIN{IGNORECASE=1}/^Permissions-Policy:/{print $0}')
jq -n --arg pp "$pp" '{prod_extra:{permissions_policy:$pp}}'
