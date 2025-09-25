#!/usr/bin/env bash
set -euo pipefail

BASE="https://www.ditonachat.com"
APEX="https://ditonachat.com"
TS="$(date -u +%Y%m%d-%H%M%S)"
OUT_DIR="_ops/reports"
OUT="$OUT_DIR/audit-$TS.txt"
LATEST="$OUT_DIR/LATEST"
mkdir -p "$OUT_DIR"

section(){ printf "\n===== %s =====\n" "$1"; }
mask(){ v="${1:-}"; n=${#v}; if [ "$n" -eq 0 ]; then echo "EMPTY"; else printf "%s***(%d)\n" "${v:0:4}" "$n"; fi; }

# write only to OUT
exec >"$OUT" 2>&1

section "0) Repo status"
echo "branch: $(git rev-parse --abbrev-ref HEAD || true)"
git --no-pager log -1 --oneline || true
git status -sb || true
git remote -v || true

section "1) Env snapshot (masked)"
echo "Node: $(node -v 2>/dev/null || echo NA)"
echo "pnpm: $(pnpm -v 2>/dev/null || echo NA)"
echo "TWILIO_ACCOUNT_SID: $(mask "${TWILIO_ACCOUNT_SID-}")"
echo "TWILIO_AUTH_TOKEN : $(mask "${TWILIO_AUTH_TOKEN-}")"
echo "TWILIO_API_KEY_SID: $(mask "${TWILIO_API_KEY_SID-}")"
echo "TWILIO_API_KEY_SECRET: $(mask "${TWILIO_API_KEY_SECRET-}")"
echo "UPSTASH_REDIS_REST_URL  : $(mask "${UPSTASH_REDIS_REST_URL-}")"
echo "UPSTASH_REDIS_REST_TOKEN: $(mask "${UPSTASH_REDIS_REST_TOKEN-}")"

section "2) Build + TypeCheck"
( pnpm -s build && echo "BUILD_OK" ) || echo "BUILD_FAIL"
( npx -y tsc --noEmit && echo "TSC_OK" ) || echo "TSC_FAIL"

section "3) API health (prod)"
echo "-- /api/rtc/env";   curl -s "$BASE/api/rtc/env"   | jq .
echo "-- /api/rtc/qlen";  curl -s "$BASE/api/rtc/qlen"  | jq .
echo "-- /api/turn";      curl -s "$BASE/api/turn"      | jq '{servers: (.iceServers|length), has443: ([.iceServers[].urls]|flatten|map(tostring)|map(contains(":443"))|any)}'

section "4) Security headers (/chat)"
curl -sI "$BASE/chat" | awk 'BEGIN{IGNORECASE=1}/^(content-security-policy|permissions-policy|referrer-policy|x-frame-options|set-cookie):/'

section "5) Anon cookie flow (www + apex)"
for B in "$BASE" "$APEX"; do
  echo "-- $B"
  J="$(mktemp)"
  curl -s -c "$J" -b "$J" "$B/api/anon/init" | jq .
  printf "enqueue -> "; curl -s -o /dev/null -w "HTTP:%{http_code}\n" -c "$J" -b "$J" -H "content-type: application/json" -d '{}' "$B/api/rtc/enqueue"
done

section "6) RTC acceptance (_ops/acc_rtc.sh)"
bash _ops/acc_rtc.sh "$BASE" || true

section "7) TURN sanity"
TURN_JSON="$(mktemp)"
curl -s "$BASE/api/turn" > "$TURN_JSON"
echo "has TCP 443?  " $(jq -r '[.iceServers[].urls]|flatten|map(tostring)|map(contains(":443"))|any' "$TURN_JSON")
echo "has credential" $(jq -r '(.iceServers[]?|select((.urls|tostring)|contains(":443"))|.credential) // "" | (length>0)' "$TURN_JSON")

section "8) UI markers in source"
echo "- Filter buttons:";  grep -RnsE 'data-ui="(country-button|gender-button)"' src || true
echo "- Labels:";          grep -RnsE '>Location<|>Gender<' src/app/chat/components/FilterBar.tsx || true
echo "- Country popover:"; grep -Rns 'grid-cols-2' src/app/chat/components/FilterBar.tsx || true
echo "- Toolbar mount:";   grep -Rns '<ChatToolbar />' src/app/chat/ChatClient.tsx || true
echo "- Messaging mount:"; grep -Rns '<ChatMessagingBar />' src/app/chat/ChatClient.tsx || true
echo "- Next/Prev:";       grep -Rns 'data-ui="btn-(next|prev)"' src || true
echo "- Camera hidden rule:"; grep -Rns '\[data-ui="btn-camera"\]' src/styles || true

section "9) VIP clamp smoke"
J="$(mktemp)"; curl -s -c "$J" -b "$J" "$BASE/api/anon/init" >/dev/null
curl -s -o /dev/null -w "enqueue over-limit -> HTTP:%{http_code}\n" \
     -c "$J" -b "$J" -H "content-type: application/json" \
     -d '{"genders":["female","male","lgbt","couples"],"countries":["DE","US","FR","EG","BR","IN","CN","JP","GB","CA","AU","ES","IT","SE","NO","FI"]}' \
     "$BASE/api/rtc/enqueue"

section "10) Summary"
echo "Saved report: $OUT"
echo "$OUT" > "$LATEST"
