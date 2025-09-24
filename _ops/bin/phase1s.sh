#!/usr/bin/env bash
set -Eeuo pipefail
export TERM=dumb
TS="$(date -u +%Y%m%d-%H%M%S)"
OUT="_ops/reports"; mkdir -p "$OUT"
LOG="$OUT/phase1S_${TS}.log"
BASE="${BASE:-https://www.ditonachat.com}"

t(){ printf "[%s] %s\n" "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG"; }

t "== Phase-1S: READ-ONLY SNAPSHOT =="

CC="src/app/chat/ChatClient.tsx"
RF="src/app/chat/rtcFlow.ts"
MSG="src/app/api/message/allow/route.ts"
MW="src/middleware.ts"

# 1) ChatClient.tsx
if [ -f "$CC" ]; then
  t "[ChatClient.tsx] markers"
  grep -nF "/api/anon/init" "$CC" | tee -a "$LOG" || true
  grep -nF "emit(\"ui:next\")" "$CC" | tee -a "$LOG" || true
  grep -nE "document\.cookie.*anon=" "$CC" | tee -a "$LOG" || true
else t "[MISS] $CC"; fi

# 2) rtcFlow.ts
if [ -f "$RF" ]; then
  t "[rtcFlow.ts] creds/cache"
  grep -nE "credentials\s*:\s*["]include  | tee -a  || true
  grep -nE caches*:s*[\"]no-store" "$RF" | tee -a "$LOG" || true
else t "[MISS] $RF"; fi

# 3) /api/rtc/* headers
t "[API rtc] headers scan (first 20 lines/file)"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  rt=$(head -n20 "$f" | grep -q ^export
