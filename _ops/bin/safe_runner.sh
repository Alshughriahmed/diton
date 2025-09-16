#!/usr/bin/env bash
set -euo pipefail
NAME="${1:?name}"; shift
LOCK="_ops/state/${NAME}.lock"
LOG="_ops/reports/${NAME}_$(date -u +%Y%m%d-%H%M%S).log"
mkdir -p "${LOCK%/*}" "_ops/reports"
# قفل بسيط دون flock
exec 9>"$LOCK"
if ! ln -n "$LOCK" "$LOCK" 2>/dev/null; then :; fi
if ! ( set -o noclobber; : > "$LOCK.pid" ) 2>/dev/null; then
  echo "ALREADY_RUNNING=1 LOG=$LOG"; exit 0
fi
echo $$ > "$LOCK.pid"
trap 'rm -f "$LOCK.pid" "$LOCK.run" 2>/dev/null || true' EXIT
: > "$LOCK.run"
( "$@" ) 2>&1 | tee -a "$LOG"
RC=${PIPESTATUS[0]}
echo "RUN_RC=$RC LOG=$LOG"
exit $RC
