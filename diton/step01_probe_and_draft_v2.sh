#!/usr/bin/env bash
set -euo pipefail

ROOT="${DITONA_ROOT:-/home/runner/workspace}"
cd "$ROOT"

ts="$(date -u +%Y%m%d-%H%M%S)"
report="_ops/reports/step01_$ts"; mkdir -p "$report"
draft="_ops/patches/draft_$ts"; mkdir -p "$draft"

# 0) Repo meta
git_hash="$(git rev-parse --short=7 HEAD 2>/dev/null || echo 'nogit')"
git_dirty="$(git status --porcelain 2>/dev/null | wc -l | awk '{print ($1>0)?1:0}')"

# 1) Event map and match sources
grep -Rno --include='*.ts' --include='*.tsx' -E "emit\(['\"]ui:(next|prev)" src | sort > "$report/emits.txt" || true
grep -Rno --include='*.ts' --include='*.tsx' -E "on\(['\"]ui:(next|prev)"   src | sort > "$report/listeners.txt" || true
grep -Rno --include='*.ts' --include='*.tsx' -E "fetch\(['\"]/api/match/next" src | sort > "$report/match_fetch_calls.txt" || true

e_next=$(grep -Ec "ui:next" "$report/emits.txt" || true)
o_next=$(grep -Ec "ui:next" "$report/listeners.txt" || true)
e_prev=$(grep -Ec "ui:prev" "$report/emits.txt" || true)
o_prev=$(grep -Ec "ui:prev" "$report/listeners.txt" || true)
match_calls=$(wc -l < "$report/match_fetch_calls.txt" 2>/dev/null || echo 0)

# 2) Probe Prev guard in Toolbar (نمط آمن)
toolbar="src/components/chat/ChatToolbar.tsx"
prev_hit="$(grep -Rno --include='*.tsx' -E 'aria-label=[^>]*Prev' "$toolbar" 2>/dev/null | head -n1 || true)"
prev_file=""; prev_line=""
if [[ -n "$prev_hit" ]]; then
  prev_file="${prev_hit%%:*}"
  prev_line="${prev_hit#*:}"; prev_line="${prev_line%%:*}"
fi

vip_guard_nearby=0
if [[ -n "$prev_file" && -n "$prev_line" ]]; then
  sed -n "$((prev_line-8)),$((prev_line+8))p" "$prev_file" > "$report/prev_context.txt" || true
  if nl -ba "$prev_file" | awk -F'\t' -v s="$((prev_line-8))" -v e="$((prev_line+8))" \
       '($1>=s && $1<=e) && ($2 ~ /isVip|vip|disabled/){found=1} END{exit(!found)}'
  then vip_guard_nearby=1; fi
fi

# 3) Draft patch: neutralize hook-level fetches (delegation to ChatClient.doMatch)
hook="src/hooks/useNextPrev.ts"
mkdir -p "$draft/original" "$draft/proposed"
if [[ -f "$hook" ]]; then
  cp "$hook" "$draft/original/useNextPrev.ts"
  awk '
    /fetch\(\x27\/api\/match\/next/ || /fetch\(\"\/api\/match\/next/ {
      print "// PATCH-DRAFT: delegated to ChatClient.doMatch via bus; original line commented below";
      print "// " $0;
      next
    }
    { print }
  ' "$hook" > "$draft/proposed/useNextPrev.ts"
  diff -u "$draft/original/useNextPrev.ts" "$draft/proposed/useNextPrev.ts" > "$draft/0001_dedupe_match_call.patch" || true
else
  : > "$draft/0001_dedupe_match_call.patch"
fi

# 4) Draft patch: add VIP guard to Prev button in Toolbar
if [[ -f "$toolbar" ]]; then
  cp "$toolbar" "$draft/original/ChatToolbar.tsx"
  has_isvip_ref=0
  (grep -q "useFilters" "$toolbar" && grep -q "isVip" "$toolbar") && has_isvip_ref=1 || true

  tmp="$draft/proposed/ChatToolbar.tmp.tsx"
  if [[ $has_isvip_ref -eq 0 ]]; then
    awk '
      NR==1 && $0 ~ /^import / { print; print "import { useFilters } from \"@/state/filters\";"; next }
      $0 ~ /function|const .*=\s*\(/ && inserted==0 { print; print "  const { isVip } = useFilters();"; inserted=1; next }
      { print }
    ' "$toolbar" > "$tmp" || cp "$toolbar" "$tmp"
  else
    cp "$toolbar" "$tmp"
  fi

  awk '
    /aria-label=[^>]*Prev/ && $0 !~ /disabled=|isVip/ {
      sub(/aria-label=[^>]*Prev/, "aria-label=\"Prev\" disabled={!isVip}");
      print; next
    }
    { print }
  ' "$tmp" > "$draft/proposed/ChatToolbar.tsx"
  diff -u "$draft/original/ChatToolbar.tsx" "$draft/proposed/ChatToolbar.tsx" > "$draft/0002_prev_vip_guard.patch" || true
  rm -f "$tmp"
else
  : > "$draft/0002_prev_vip_guard.patch"
fi

# 5) Summaries
{
  echo "Git hash: $git_hash"
  echo "Dirty: $git_dirty"
  echo "EMIT_next=$e_next"
  echo "ON_next=$o_next"
  echo "EMIT_prev=$e_prev"
  echo "ON_prev=$o_prev"
  echo "MATCH_FETCH_CALLS=$match_calls"
  echo "VIPPrevGuardNearby=$vip_guard_nearby"
  echo "Drafts: $(ls -1 "$draft"/*.patch 2>/dev/null | wc -l | awk '{print $1}')"
} > "$report/summary.txt"

# 6) Acceptance
echo "-- Acceptance --"
echo "GIT_HASH=$git_hash"
echo "BUS_EMIT_NEXT=$e_next"
echo "BUS_ON_NEXT=$o_next"
echo "BUS_EMIT_PREV=$e_prev"
echo "BUS_ON_PREV=$o_prev"
echo "MATCH_FETCH_CALLS=$match_calls"
echo "ONE_SOURCE_MATCH_CALL_OK=$([ "$match_calls" -eq 1 ] && echo 1 || echo 0)"
echo "VIPPrevGuardNearby=$vip_guard_nearby"
echo "REPORT_DIR=$report"
echo "PATCH_DRAFTS_DIR=$draft"
echo "PATCH_FILES=$(ls -1 "$draft"/*.patch 2>/dev/null | wc -l | awk '{print $1}')"
