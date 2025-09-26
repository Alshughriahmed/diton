#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://www.ditonachat.com}"

health=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")

pre=$(curl -s -D - -o /dev/null "$BASE/chat" | awk 'NR==1{print $2}')
curl -s -X POST -c /tmp/age.ok "$BASE/api/age/allow" >/dev/null
post=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/age.ok "$BASE/chat")

pp=$(curl -sI "$BASE/chat" | awk 'BEGIN{IGNORECASE=1}/^Permissions-Policy:/{print $0}' || true)

css=$(curl -s "$BASE/" | grep -o '/_next/static/css/[^"]\+\.css' | head -n1)
util="missing"; [ -n "$css" ] && curl -s "$BASE$css" | grep -q 'min-h-screen' && util="found"

vip_pre=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/user/vip-status")
vip_post=$(curl -s -o /dev/null -w "%{http_code}" -H 'Cookie: vip=1' "$BASE/api/user/vip-status")

codes=(); for i in 1 2 3 4 5; do
  codes+=("$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/match/next?gender=all&countries=US")")
done

jq -n \
  --arg base "$BASE" \
  --arg health "$health" \
  --arg pre "$pre" \
  --arg post "$post" \
  --arg pp "$pp" \
  --arg util "$util" \
  --arg vip_pre "$vip_pre" \
  --arg vip_post "$vip_post" \
  --argjson burst "$(printf '%s\n' "${codes[@]}" | jq -R . | jq -s .)" \
  '{
    prod:{
      base:$base,
      health:($health|tonumber),
      age_flow:{pre:$pre, post:($post|tonumber)},
      permissions_policy:$pp,
      css_utilities:($util=="found"),
      vip:{pre:($vip_pre|tonumber), post:($vip_post|tonumber)},
      ratelimit_burst:$burst
    }
  }'
