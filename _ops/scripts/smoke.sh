#!/usr/bin/env bash
set -Eeuo pipefail
set +H
export TERM=dumb

ROOT="/home/runner/workspace"
cd "$ROOT"
RPT_DIR="_ops/reports"
TS="$(date -u +%Y%m%d-%H%M%S)"
LOG="$RPT_DIR/smoke_run_$TS.log"
mkdir -p "$RPT_DIR"

PORT="${PORT:-3000}"
BASE="http://127.0.0.1:$PORT"

echo "[SMOKE] starting at $(date -u)" | tee -a "$LOG"

# Start server in background if not responding
NEED_START=0
if ! curl -fsS "$BASE/api/rtc/env" -o /dev/null 2>>"$LOG"; then
  NEED_START=1
  ( PORT="$PORT" pnpm -s start >> "$RPT_DIR/server_$TS.log" 2>&1 ) &
  SRV_PID=$!
  # wait up to 60s
  for i in {1..60}; do
    if curl -fsS "$BASE/api/rtc/env" -o /dev/null 2>>"$LOG"; then break; fi
    sleep 1
  done
fi

pass=0; fail=0

hdr_nostore () { curl -fsS -D - -o /dev/null "$1" 2>>"$LOG" | tr -d "\r" | awk "BEGIN{ok=0} tolower(\$0) ~ /^cache-control:/ { if (index(tolower(\$0), \"no-store\")) ok=1 } END{ print ok }"; }

test_get () {
  name="$1"; url="$2"
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
  hns="$(hdr_nostore "$url" || echo 0)"
  if [[ "$code" =~ ^2 && "$hns" = "1" ]]; then echo "[PASS] $name ($code, no-store)"; pass=$((pass+1)); else echo "[FAIL] $name (code=$code, no-store=$hns)"; fail=$((fail+1)); fi
}

test_like_idemp () {
  key="smoke-$(date +%s)-$RANDOM"
  body={op:toggle}
  c1="$(curl -sS -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" -H "x-idempotency: " -X POST "$BASE/api/like" -d "$body" || true)"
  resp2="$(curl -sS -H "Content-Type: application/json" -H "x-idempotency: " -X POST "$BASE/api/like" -d "$body" || true)"
  dup="$(echo "$resp2" | grep -o "\"duplicate\":[ ]*true" || true)"
  hns="$(curl -sS -D - -o /dev/null -H "x-idempotency: $key" -H "Content-Type: application/json" -X POST "$BASE/api/like" -d "$body" 2>>"$LOG" | tr -d "\r" | awk "BEGIN{ok=0} tolower(\$0) ~ /^cache-control:/ { if (index(tolower(\$0), \"no-store\")) ok=1 } END{ print ok }")"
  if [[ "$c1" =~ ^2 && -n "$dup" && "$hns" = "1" ]]; then echo "[PASS] like idempotency"; pass=$((pass+1)); else echo "[FAIL] like idempotency (first=$c1, dupFlag=${dup:-no}, no-store=$hns)"; fail=$((fail+1)); fi
}

test_get "rtc/env" "$BASE/api/rtc/env"
test_get "rtc/qlen" "$BASE/api/rtc/qlen"
test_get "user/vip-status" "$BASE/api/user/vip-status"
test_like_idemp

echo "[SMOKE] pass=$pass fail=$fail" | tee -a "$LOG"

# Stop server if we started it
if [[ "${NEED_START:-0}" = "1" ]]; then
  # try to kill by port
  if command -v lsof >/dev/null 2>&1; then
    PID="$(lsof -t -i TCP:$PORT || true)"; [[ -n "$PID" ]] && kill "$PID" 2>/dev/null || true
  fi
  [[ -n "${SRV_PID:-}" ]] && kill "$SRV_PID" 2>/dev/null || true
fi

# Exit with failure if any test failed
[[ "$fail" -eq 0 ]]
