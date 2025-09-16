set -Eeuo pipefail
PORT="${PORT:-3000}"; BASE="http://127.0.0.1:$PORT"
NEED_PATCH=0
grep -q "prev-for" src/lib/rtc/mm.ts || NEED_PATCH=1
grep -q "rtc:last:" src/lib/rtc/mm.ts || NEED_PATCH=1
grep -q "prev requires vip" src/app/api/match/next/route.ts || NEED_PATCH=1
[ "$NEED_PATCH" = 1 ] && bash _ops/bin/006_prev_vip_fix.sh >/dev/null
code="$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health" || echo 000)"
[ "$code" = 200 ] || bash _ops/bin/004_dev_restart_bg.sh >/dev/null
bash _ops/bin/005_prev_vip_acc.sh
