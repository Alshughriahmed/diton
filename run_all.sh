#!/usr/bin/env bash
set -euo pipefail
source ./.diag.env 2>/dev/null || true
BASE="${BASE:-http://localhost:3000}"
COOKIEJAR="${COOKIEJAR:-.diag.cookies}"
mkdir -p _ops/logs _ops/out
LOG="_ops/logs/diag_$(date -u +%Y%m%d-%H%M%S).log"
say(){ echo -e "$@" | tee -a "$LOG"; }
pass(){ echo 1; }
fail(){ echo 0; }

H_HEALTH=0 H_ROOT=0 H_PLANS=0 H_CHAT_307=0 H_CHAT200=0 H_PERM=0 H_CSS=0 H_UTIL=0 H_MATCH=0 H_MSGAPI=0 H_VIPPRE=0 H_VIPPOST=0
trap 'say "\n-- Acceptance --\nBASE=$BASE\nHEALTH=$H_HEALTH ROOT=$H_ROOT PLANS=$H_PLANS CHAT_REDIRECT=$H_CHAT_307 CHAT_OK=$H_CHAT200\nPERMISSIONS_POLICY=$H_PERM CSS_LINK=$H_CSS UTILITIES=$H_UTIL MATCH_ECHO=$H_MATCH MSG_API=$H_MSGAPI VIP_PRE=$H_VIPPRE VIP_POST=$H_VIPPOST\n-- End Acceptance --"' EXIT

say "== DitonaChat Diagnostics on $BASE =="; :> "$COOKIEJAR"

code=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE/api/health" || true); [[ "$code" == "200" ]] && H_HEALTH=$(pass) || H_HEALTH=$(fail); say "health: $code"
code=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE/"); [[ "$code" == "200" ]] && H_ROOT=$(pass) || H_ROOT=$(fail); say "/: $code"
code=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE/plans"); [[ "$code" == "200" ]] && H_PLANS=$(pass) || H_PLANS=$(fail); say "/plans: $code"

hdrs=$(curl -skI "$BASE/chat"); echo "$hdrs" | grep -qi "^location: " && echo "$hdrs" | grep -q " 307 " && H_CHAT_307=$(pass) || H_CHAT_307=$(fail); say "/chat HEAD -> redirect? $( [[ $H_CHAT_307 -eq 1 ]] && echo yes || echo no )"
curl -sk -c "$COOKIEJAR" -X POST "$BASE/api/age/allow" -o /dev/null
code=$(curl -sk -b "$COOKIEJAR" -o /dev/null -w "%{http_code}" "$BASE/chat"); [[ "$code" == "200" ]] && H_CHAT200=$(pass) || H_CHAT200=$(fail); say "chat after age allow: $code"

pp=$(curl -skI -b "$COOKIEJAR" "$BASE/chat" | tr -d '\r' | awk -F': ' 'BEGIN{IGNORECASE=1}/^Permissions-Policy:/{print $2}')
echo "$pp" | grep -q "camera=(self)" && echo "$pp" | grep -q "microphone=(self)" && H_PERM=$(pass) || H_PERM=$(fail); say "Permissions-Policy: ${pp:-<none>}"

home=$(curl -sk "$BASE/"); css_path=$(echo "$home" | grep -Eo "/_next/static/css/[^\"']+\.css" | head -n1 || true)
if [[ -n "${css_path:-}" ]]; then H_CSS=$(pass); ct=$(curl -skI "$BASE$css_path" | tr -d '\r' | awk -F': ' 'BEGIN{IGNORECASE=1}/^content-type:/{print $2}'); css=$(curl -sk "$BASE$css_path" | head -n 200); echo "$css" | grep -q "\.flex" && H_UTIL=$(pass) || H_UTIL=$(fail); say "CSS: $css_path (CT=$ct) utilities=$( [[ $H_UTIL -eq 1 ]] && echo found || echo missing )"; else H_CSS=$(fail); say "CSS: not found"; fi

resp=$(curl -sk -b "$COOKIEJAR" "$BASE/api/match/next?gender=male&countries=US,DE" || true); echo "$resp" > _ops/out/match_echo.json
echo "$resp" | grep -q '"gender"' && echo "$resp" | grep -q '"countries"' && echo "$resp" | grep -Eq '"ts":[0-9]+' && H_MATCH=$(pass) || H_MATCH=$(fail); say "/api/match/next sample: $( [[ $H_MATCH -eq 1 ]] && echo ok || echo bad )"

MSG_EP="$BASE/api/debug/echo-message"; code=$(curl -sk -o /dev/null -w "%{http_code}" "$MSG_EP" || true)
if [[ "$code" == "200" ]]; then resp=$(curl -sk -X POST -H 'content-type: application/json' -d '{"m":"ping"}' "$MSG_EP"); echo "$resp" | grep -qi "ping" && H_MSGAPI=$(pass) || H_MSGAPI=$(fail); say "message API: $H_MSGAPI"; else say "message API: skipped"; fi

pre=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE/api/user/vip-status" || true); [[ "$pre" == "200" ]] && H_VIPPRE=$(pass) || H_VIPPRE=$(fail)
curl -sk -b "$COOKIEJAR" -c "$COOKIEJAR" -X POST "$BASE/api/stripe/portal" -o /dev/null || true
post=$(curl -sk -b "$COOKIEJAR" -o /dev/null -w "%{http_code}" "$BASE/api/user/vip-status" || true); [[ "$post" == "200" ]] && H_VIPPOST=$(pass) || H_VIPPOST=$(fail)
say "vip pre=$pre post=$post"; say "Log saved: $LOG"
