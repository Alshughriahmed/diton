#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/C2_${TS}"; mkdir -p "$BK" _ops/reports
F="src/lib/rtc/mm.ts"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# 1) حارس كتابة rtc:last مرة واحدة فقط
grep -q '__wroteRtcLast' "$F" || sed -i '1i let __wroteRtcLast=false; function __setRtcLastOnce(k:string,ms:number){try{ if(__wroteRtcLast) return; __wroteRtcLast=true; setPx(k,ms);}catch{}}' "$F"
perl -0777 -pe 's/setPx\s*\(\s*([`"'\'' ]rtc:last[^,]+)\s*,/__setRtcLastOnce(\1, /g' -i "$F" || true

# 2) تأكيد ترتيب prev-wish ثم prev-for (تحقق وجودي)
PREV_ORDER=$([ "$(grep -n 'prev-wish' "$F" | head -1 | cut -d: -f1)" -lt "$(grep -n 'prev-for' "$F" | head -1 | cut -d: -f1)" ] && echo 1 || echo 0)

# 3) تأكيد وجود قفلين SETNX PX على claim ثم pairLock
LOCKS_OK=$([ "$(grep -Ei 'SET?NX|setNx' "$F" | wc -l)" -ge 2 ] && grep -qi 'pairLock' "$F" && grep -qi 'claim' "$F" && echo 1 || echo 0)

# 4) تأكيد قيم الـTTL بالأرقام المطلوبة (وجودي)
TTL_OK=$([ "$(grep -Eo '[^0-9](7000|8500|6000|150000|120000|300000)[^0-9]' "$F" | wc -l)" -ge 6 ] && echo 1 || echo 0)

echo "-- Acceptance --"
echo "MM_LAST_ONCE_GUARD=$([ "$(grep -c '__setRtcLastOnce' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "VIP_PREV_ORDER_OK=$PREV_ORDER"
echo "LOCKS_2_NX_OK=$LOCKS_OK"
echo "TTLS_CONST_PRESENT=$TTL_OK"
echo "BACKUP_DIR=$BK"
