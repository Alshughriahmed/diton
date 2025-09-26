#!/usr/bin/env bash
set -u  # بدون -e حتى لا يتوقف عند أول خطأ

ROOT="${DITONA_ROOT:-/home/runner/workspace}"; cd "$ROOT" 2>/dev/null || true
ts="$(date -u +%Y%m%d-%H%M%S)"
report="_ops/reports/step01_$ts"; mkdir -p "$report" 2>/dev/null || true
draft="_ops/patches/draft_$ts"; mkdir -p "$draft/original" "$draft/proposed" 2>/dev/null || true

# مقادير افتراضية
git_hash="nogit"; git_dirty=0
e_next=0; o_next=0; e_prev=0; o_prev=0; match_calls=0
vip_guard_nearby=0

# 0) Git
git_hash="$(git rev-parse --short=7 HEAD 2>/dev/null || echo nogit)"
git status --porcelain >/dev/null 2>&1 && git_dirty=1 || git_dirty=0

# 1) خريطة الأحداث ومصادر match
grep -Rno --include='*.ts' --include='*.tsx' -E "emit\(['\"]ui:(next|prev)" src 2>/dev/null | sort > "$report/emits.txt" || true
grep -Rno --include='*.ts' --include='*.tsx' -E "on\(['\"]ui:(next|prev)"   src 2>/dev/null | sort > "$report/listeners.txt" || true
grep -Rno --include='*.ts' --include='*.tsx' -E "fetch\(['\"]/api/match/next" src 2>/dev/null | sort > "$report/match_fetch_calls.txt" || true

e_next=$(grep -Ec "ui:next" "$report/emits.txt" 2>/dev/null || echo 0)
o_next=$(grep -Ec "ui:next" "$report/listeners.txt" 2>/dev/null || echo 0)
e_prev=$(grep -Ec "ui:prev" "$report/emits.txt" 2>/dev/null || echo 0)
o_prev=$(grep -Ec "ui:prev" "$report/listeners.txt" 2>/dev/null || echo 0)
match_calls=$(wc -l < "$report/match_fetch_calls.txt" 2>/dev/null || echo 0)

# 2) فحص Prev في Toolbar
toolbar="src/components/chat/ChatToolbar.tsx"
prev_hit="$(grep -Rno --include='*.tsx' -E 'aria-label=[^>]*Prev' "$toolbar" 2>/dev/null | head -n1 || true)"
prev_file=""; prev_line=""
if [ -n "${prev_hit:-}" ]; then
  prev_file="${prev_hit%%:*}"
  tmp="${prev_hit#*:}"; prev_line="${tmp%%:*}"
fi
if [ -n "${prev_file:-}" ] && [ -n "${prev_line:-}" ]; then
  sed -n "$((prev_line>8?prev_line-8:1)),$((prev_line+8))p" "$prev_file" > "$report/prev_context.txt" 2>/dev/null || true
  nl -ba "$prev_file" 2>/dev/null | awk -F'\t' -v s="$((prev_line>8?prev_line-8:1))" -v e="$((prev_line+8))" \
     '($1>=s && $1<=e) && ($2 ~ /isVip|vip|disabled/){found=1} END{exit(!found)}' >/dev/null 2>&1 && vip_guard_nearby=1 || vip_guard_nearby=0
fi

# 3) مسودّة: نزع fetch من hook (تعليق السطر فقط)
hook="src/hooks/useNextPrev.ts"
if [ -f "$hook" ]; then
  cp "$hook" "$draft/original/useNextPrev.ts" 2>/dev/null || true
  awk '
    /fetch\([\"\x27]\/api\/match\/next/ {
      print "// PATCH-DRAFT: delegate to ChatClient.doMatch via bus; original commented:";
      print "// " $0; next
    }
    { print }
  ' "$hook" > "$draft/proposed/useNextPrev.ts" 2>/dev/null || cp "$hook" "$draft/proposed/useNextPrev.ts"
  diff -u "$draft/original/useNextPrev.ts" "$draft/proposed/useNextPrev.ts" > "$draft/0001_dedupe_match_call.patch" 2>/dev/null || true
fi

# 4) مسودّة: إضافة disabled={!isVip} لزر Prev
if [ -f "$toolbar" ]; then
  cp "$toolbar" "$draft/original/ChatToolbar.tsx" 2>/dev/null || true
  tmp="$draft/proposed/ChatToolbar.tmp.tsx"
  cp "$toolbar" "$tmp" 2>/dev/null || true

  # إدراج useFilters/isVip إن لم يكن موجودًا
  grep -q "useFilters" "$tmp" 2>/dev/null || sed -i '1a import { useFilters } from "@/state/filters";' "$tmp"
  grep -q "{ isVip }" "$tmp" 2>/dev/null || sed -i '0,/^[[:space:]]*(function|const)[^$]*/s//&\n  const { isVip } = useFilters();/' "$tmp" 2>/dev/null || true

  awk '
    /aria-label=[^>]*Prev/ && $0 !~ /disabled=|isVip/ { sub(/aria-label=[^>]*Prev/, "aria-label=\"Prev\" disabled={!isVip}"); print; next }
    { print }
  ' "$tmp" > "$draft/proposed/ChatToolbar.tsx" 2>/dev/null || cp "$tmp" "$draft/proposed/ChatToolbar.tsx"
  diff -u "$draft/original/ChatToolbar.tsx" "$draft/proposed/ChatToolbar.tsx" > "$draft/0002_prev_vip_guard.patch" 2>/dev/null || true
  rm -f "$tmp" 2>/dev/null || true
fi

# 5) قبول
echo "-- Acceptance --"
echo "GIT_HASH=$git_hash"
echo "BUS_EMIT_NEXT=$e_next"
echo "BUS_ON_NEXT=$o_next"
echo "BUS_EMIT_PREV=$e_prev"
echo "BUS_ON_PREV=$o_prev"
echo "MATCH_FETCH_CALLS=$match_calls"
echo "ONE_SOURCE_MATCH_CALL_OK=$([ "${match_calls:-0}" -eq 1 ] && echo 1 || echo 0)"
echo "VIPPrevGuardNearby=$vip_guard_nearby"
echo "REPORT_DIR=$report"
echo "PATCH_DRAFTS_DIR=$draft"
echo "PATCH_FILES=$(ls -1 "$draft"/*.patch 2>/dev/null | wc -l | awk '{print $1}')"
