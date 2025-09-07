#!/usr/bin/env bash
set -euo pipefail
ROOT="${DITONA_ROOT:-/home/runner/workspace}"
cd "$ROOT"

ts="$(date -u +%Y%m%d-%H%M%S)"
out="_ops/reports/step01_simple_$ts"; mkdir -p "$out"

# 1) خريطة emit/on
grep -Rno --include='*.ts' --include='*.tsx' -E "emit\(['\"]ui:(next|prev)" src | sort > "$out/emits.txt" || true
grep -Rno --include='*.ts' --include='*.tsx' -E "on\(['\"]ui:(next|prev)"   src | sort > "$out/listeners.txt" || true
e_next=$(grep -Ec "ui:next" "$out/emits.txt" 2>/dev/null || echo 0)
o_next=$(grep -Ec "ui:next" "$out/listeners.txt" 2>/dev/null || echo 0)
e_prev=$(grep -Ec "ui:prev" "$out/emits.txt" 2>/dev/null || echo 0)
o_prev=$(grep -Ec "ui:prev" "$out/listeners.txt" 2>/dev/null || echo 0)

# 2) مصادر fetch لـ /api/match/next
grep -Rno --include='*.ts' --include='*.tsx' -E "fetch\(['\"]/api/match/next" src | sort > "$out/match_fetch_calls.txt" || true
match_calls=$(wc -l < "$out/match_fetch_calls.txt" 2>/dev/null || echo 0)

# 3) حارس VIP لزر Prev في الواجهة
toolbar="src/components/chat/ChatToolbar.tsx"
prev_hit="$(grep -Rno --include='*.tsx' -E 'aria-label=[^>]*Prev' "$toolbar" 2>/dev/null | head -n1 || true)"
vip_guard=0
if [[ -n "$prev_hit" ]]; then
  file="${prev_hit%%:*}"; ln="${prev_hit#*:}"; ln="${ln%%:*}"
  sed -n "$((ln>5?ln-5:1)),$((ln+5))p" "$file" > "$out/prev_context.txt" 2>/dev/null || true
  grep -E 'disabled|isVip' "$out/prev_context.txt" >/dev/null 2>&1 && vip_guard=1 || vip_guard=0
fi

echo "-- Acceptance --"
echo "EMIT_next=$e_next"
echo "ON_next=$o_next"
echo "EMIT_prev=$e_prev"
echo "ON_prev=$o_prev"
echo "MATCH_FETCH_CALLS=$match_calls"
echo "ONE_SOURCE_MATCH_CALL_OK=$([ "$match_calls" -eq 1 ] && echo 1 || echo 0)"
echo "VIPPrevGuard=$vip_guard"
echo "ARTIFACTS_DIR=$out"
