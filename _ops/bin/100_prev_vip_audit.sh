. _ops/bin/disable_alt_screen.sh || true
#!/usr/bin/env bash
set -Eeuo pipefail

TS="$(date -u +%Y%m%d-%H%M%S)"
REP="_ops/reports/prev_vip_audit_${TS}.log"
PORT="${PORT:-3000}"
BASE="http://127.0.0.1:${PORT}"
URL="${UPSTASH_REDIS_REST_URL:-}/pipeline"
TOK="${UPSTASH_REDIS_REST_TOKEN:-}"

log(){ echo "$@" | tee -a "$REP"; }

# 0) صحة الخدمة
H="$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health" || echo 000)"
log "HEALTH=$H"
if [ "$H" != 200 ]; then
  log "SERVICE_NOT_HEALTHY"
  exit 1
fi

# 1) كوكي جلستين حقيقيتين
get_cookie(){ curl -sS -D - -o /dev/null "$BASE/api/anon/init" | awk '/^[Ss]et-[Cc]ookie:/ {print $2}' | head -n1 | sed 's/;.*//'; }
CKA="$(get_cookie)"; CKB="$(get_cookie)"
log "CKA=${CKA:-EMPTY}"
log "CKB=${CKB:-EMPTY}"

# 2) إدراج عبر API
curl -s -X POST "$BASE/api/rtc/enqueue" -H "Cookie: $CKA" -H "content-type: application/json" \
  -d '{"gender":"male","country":"DE","genders":"all","countries":"ALL"}' >/dev/null
curl -s -X POST "$BASE/api/rtc/enqueue" -H "Cookie: $CKB" -H "content-type: application/json" \
  -d '{"gender":"female","country":"DE","genders":"all","countries":"ALL"}' >/dev/null

# 3) مطابقة أولى للطرف A
MM1="$(curl -s -o /tmp/mm1.json -w "%{http_code}" -X POST "$BASE/api/rtc/matchmake" -H "Cookie: $CKA" -H "content-type: application/json" -d '{}' || echo 000)"
PAIR1="$(sed -nE 's/.*"pairId":"([^"]+)".*/\1/p' /tmp/mm1.json)"
PEER_B="$(sed -nE 's/.*"peerAnonId":"([^"]+)".*/\1/p' /tmp/mm1.json)"
log "MM1=$MM1 PAIR1=${PAIR1:-} PEER_B=${PEER_B:-}"

# إعادة إدراج B
curl -s -X POST "$BASE/api/rtc/enqueue" -H "Cookie: $CKB" -H "content-type: application/json" \
  -d '{"gender":"female","country":"DE","genders":"all","countries":"ALL"}' >/dev/null

# 4) طلب Prev من A كـ VIP
P200="$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: $CKA; vip=1" -H "x-ditona-prev: 1" "$BASE/api/match/next" || echo 000)"
log "PREV_HTTP=$P200"

# 5) مطابقة ثانية لـ B (نتوقع callee + peerAnonId = UUID A)
MM2="$(curl -s -o /tmp/mm2.json -w "%{http_code}" -X POST "$BASE/api/rtc/matchmake" -H "Cookie: $CKB" -H "content-type: application/json" -d '{}' || echo 000)"
ROLE2="$(sed -nE 's/.*"role":"([^"]+)".*/\1/p' /tmp/mm2.json)"
PEER_A="$(sed -nE 's/.*"peerAnonId":"([^"]+)".*/\1/p' /tmp/mm2.json)"
log "MM2=$MM2 ROLE2=${ROLE2:-} PEER_A=${PEER_A:-}"

# 6) فحص Redis (اختياري إن توفرت البيئة)
if [ -n "${UPSTASH_REDIS_REST_URL:-}" ] && [ -n "$TOK" ] && [ -n "${PEER_A:-}" ] && [ -n "${PEER_B:-}" ]; then
  AUTH="Authorization: Bearer $TOK"
  PAY_PREV='[ ["EXISTS","rtc:prev-wish:'"$PEER_A"'"], ["EXISTS","rtc:prev-for:'"$PEER_B"'"] ]'
  PAY_LAST='[ ["EXISTS","rtc:last:'"$PEER_A"'"], ["EXISTS","rtc:last:'"$PEER_B"'"] ]'
  EXPREV="$(curl -sS -X POST "$URL" -H "$AUTH" -H "content-type: application/json" -d "$PAY_PREV")"
  EXLAST="$(curl -sS -X POST "$URL" -H "$AUTH" -H "content-type: application/json" -d "$PAY_LAST")"
  log "EXPREV=$EXPREV"
  log "EXLAST=$EXLAST"
else
  log "UPSTASH_ENV=ABSENT_OR_IDS_MISSING"
fi

# 7) قبول نهائي
ok_prev="$(echo "${EXPREV:-}" | grep -o '"result":[01]' | grep -o '[01]' | tr -d '\n' || true)"
ok_last="$(echo "${EXLAST:-}" | grep -o '"result":[01]' | grep -o '[01]' | tr -d '\n' || true)"

echo >>"$REP"
log "-- Acceptance --"
log "INITIAL_PAIR_OK=$([ -n "$PAIR1" ] && [ "$MM1" = 200 ] && echo 1 || echo 0)"
log "RECONNECT_OK=$([ "$MM2" = 200 ] && [ "$ROLE2" = callee ] && [ -n "$PEER_A" ] && echo 1 || echo 0)"
log "VIP_PREV_ENFORCED=$([ "$P200" = 200 ] && echo 1 || echo 0)"
[ -n "$ok_prev" ] && log "PREV_KEYS_WRITTEN=$([ "$ok_prev" = 11 ] && echo 1 || echo 0)" || log "PREV_KEYS_WRITTEN=NA"
[ -n "$ok_last" ] && log "LAST_KEYS_SET=$([ "$ok_last" = 11 ] && echo 1 || echo 0)" || log "LAST_KEYS_SET=NA"

echo; echo "REPORT=$REP"
sed -n '1,200p' "$REP" || true
