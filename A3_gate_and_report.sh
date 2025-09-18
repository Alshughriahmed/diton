#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
BASE="${BASE:-http://localhost:5000}"
OUT="_ops/reports/batch_A_report.log"; :> "$OUT"

h(){ curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health"; }
t(){ curl -s "$BASE/api/turn" | tr -d '\r' | tr -d '\n' | grep -Eo '(turns?:[^"]*:(443|5349))' | head -n1; }
s(){ curl -s "$BASE/api/stripe/prices" | tr -d '\r' | grep -Eo '"id"|"unit_amount' -c; }
e(){ curl -s "$BASE/api/rtc/env" | tr -d '\r'; }

# رؤوس لمسارين REST فقط
hdr_ok(){
  local path="$1"
  local H="$(curl -s -I "$BASE$path")"
  echo "$H" | grep -qi '^content-type:.*application/json' && echo "$H" | grep -qi '^cache-control:.*no-store'
}

HEALTH_OK=$([ "$(h)" = "200" ] && echo 1 || echo 0)
TURN_443_OK=$([ -n "$(t)" ] && echo 1 || echo 0)
STRIPE_JSON_OK=$([ "$(s)" -ge 4 ] && echo 1 || echo 0)
ENV_OUT="$(e)"
ENV_FFA_OK=$([[ "$ENV_OUT" =~ FREE_FOR_ALL ]] && [[ "$ENV_OUT" =~ NEXT_PUBLIC_FREE_FOR_ALL ]] && echo 1 || echo 0)
API_JSON_NOCACHE_OK=$(
  hdr_ok "/api/rtc/matchmake" >/dev/null 2>&1 && hdr_ok "/api/monitoring/metrics" >/dev/null 2>&1 && echo 1 || echo 0
)

# لائحة الملفات المعدّلة
FILES_TOUCHED="_ops/reports/batch_A_files.tmp"
echo "-- Acceptance --"        | tee -a "$OUT"
echo "HEALTH_OK=$HEALTH_OK"    | tee -a "$OUT"
echo "TURN_443_OK=$TURN_443_OK"| tee -a "$OUT"
echo "STRIPE_JSON_OK=$STRIPE_JSON_OK" | tee -a "$OUT"
echo "STRIPE_PLANS_OK=$([ "$STRIPE_JSON_OK" -eq 1 ] && echo 1 || echo 0)" | tee -a "$OUT"
echo "ENV_FFA_OK=$ENV_FFA_OK"  | tee -a "$OUT"
echo "API_JSON_NOCACHE_OK=$API_JSON_NOCACHE_OK" | tee -a "$OUT"
echo "BASE=$BASE"              | tee -a "$OUT"

echo -e "\n-- Snippets --"     | tee -a "$OUT"
for P in /api/rtc/matchmake /api/monitoring/metrics; do
  echo "curl -i $BASE$P (headers)" | tee -a "$OUT"
  curl -s -I "$BASE$P" | sed -n '1,15p' | tee -a "$OUT"
done

echo -e "\n-- Files touched --" | tee -a "$OUT"
if [ -f "$FILES_TOUCHED" ]; then
  sort -u "$FILES_TOUCHED" | while read -r f; do
    [ -f "$f" ] && { echo -n "$f  "; wc -l < "$f"; } | tee -a "$OUT"
  done
fi

echo -e "\nREPORT=$OUT"
