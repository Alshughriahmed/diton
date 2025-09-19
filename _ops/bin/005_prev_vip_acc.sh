. _ops/bin/disable_alt_screen.sh || true
set -Eeuo pipefail
PORT="${PORT:-5000}"; BASE="http://127.0.0.1:${PORT}"
[ -n "${UPSTASH_REDIS_REST_URL:-}" ] || { echo "NO_UPSTASH_URL"; exit 1; }
[ -n "${UPSTASH_REDIS_REST_TOKEN:-}" ] || { echo "NO_UPSTASH_TOKEN"; exit 1; }
URL="$UPSTASH_REDIS_REST_URL/pipeline"; HDR="Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
TS="$(date -u +%Y%m%d-%H%M%S)"; A="anon_A_${TS}"; B="anon_B_${TS}"; GA="male"; GB="female"; CA="DE"; CB="DE"; now="$(date +%s%3N)"

# Setup users A and B
curl -sS -X POST "$URL" -H "$HDR" -H 'content-type: application/json' -d "[[\"HSET\",\"rtc:attrs:${A}\",\"gender\",\"${GA}\",\"country\",\"${CA}\"],[\"EXPIRE\",\"rtc:attrs:${A}\",\"120\"],[\"HSET\",\"rtc:filters:${A}\",\"genders\",\"all\",\"countries\",\"ALL\"],[\"EXPIRE\",\"rtc:filters:${A}\",\"120\"],[\"ZADD\",\"rtc:q\",\"${now}\",\"${A}\"],[\"ZADD\",\"rtc:q:gender:${GA}\",\"${now}\",\"${A}\"],[\"ZADD\",\"rtc:q:country:${CA}\",\"${now}\",\"${A}\"],[\"HSET\",\"rtc:attrs:${B}\",\"gender\",\"${GB}\",\"country\",\"${CB}\"],[\"EXPIRE\",\"rtc:attrs:${B}\",\"120\"],[\"HSET\",\"rtc:filters:${B}\",\"genders\",\"all\",\"countries\",\"ALL\"],[\"EXPIRE\",\"rtc:filters:${B}\",\"120\"]]" >/dev/null

# A does matchmake (should match with no one initially)
MA="$(curl -sS -X POST "$BASE/api/rtc/matchmake" -H "Cookie: anon=${A}" -H "content-type: application/json" -d "{}")"
PAIR="$(printf "%s" "$MA" | sed -nE 's/.*"pairId":"([^"]+)".*/\1/p')"

# Add B to queue
curl -sS -X POST "$URL" -H "$HDR" -H 'content-type: application/json' -d "[[\"ZADD\",\"rtc:q\",\"$((now+1))\",\"${B}\"],[\"ZADD\",\"rtc:q:gender:${GB}\",\"$((now+1))\",\"${B}\"],[\"ZADD\",\"rtc:q:country:${CB}\",\"$((now+1))\",\"${B}\"]]" >/dev/null

# Test VIP prev enforcement (should be 403 without VIP, 200 with VIP)
C403="$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: anon=${A}" -H "x-ditona-prev: 1" "$BASE/api/match/next")"
C200="$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: anon=${A}; vip=1" -H "x-ditona-prev: 1" "$BASE/api/match/next")"

# Check if last keys and prev keys were set
EXISTS="$(curl -sS -X POST "$URL" -H "$HDR" -H 'content-type: application/json' -d "[[\"EXISTS\",\"rtc:last:${A}\"],[\"EXISTS\",\"rtc:last:${B}\"],[\"EXISTS\",\"rtc:prev-wish:${A}\"],[\"EXISTS\",\"rtc:prev-for:${B}\"]]")"
LSET=$([ "$(printf "%s" "$EXISTS" | sed -nE 's/.*\[\{"result":([01])\},\{"result":([01])\}.*/\1\2/p')" = "11" ] && echo 1 || echo 0)
PSET=$([ "$(printf "%s" "$EXISTS" | sed -nE 's/.*\[\{"result":[01]\},\{"result":[01]\},\{"result":([01])\},\{"result":([01])\}.*/\1\2/p')" = "11" ] && echo 1 || echo 0)

# B does matchmake (should reconnect with A via prev-for mechanism)
MB="$(curl -sS -X POST "$BASE/api/rtc/matchmake" -H "Cookie: anon=${B}" -H "content-type: application/json" -d "{}")"
PEER_OF_B="$(printf "%s" "$MB" | sed -nE 's/.*"peerAnonId":"([^"]+)".*/\1/p')"
ROLE_B="$(printf "%s" "$MB" | sed -nE 's/.*"role":"([^"]+)".*/\1/p')"

echo "-- Acceptance --"
echo "INITIAL_PAIR_OK=$([ -n "$PAIR" ] && echo 1 || echo 0)"
echo "LAST_KEYS_SET=$LSET"
echo "PREV_KEYS_WRITTEN=$PSET"
echo "RECONNECT_OK=$([ "$PEER_OF_B" = "$A" ] && [ "$ROLE_B" = "callee" ] && echo 1 || echo 0)"
echo "VIP_PREV_ENFORCED=$([ "$C403" = "403" ] && [ "$C200" = "200" ] && echo 1 || echo 0)"
