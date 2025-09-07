#!/usr/bin/env bash
set -euo pipefail
. "_ops/bin/hold.sh"

if [[ $# -lt 1 ]]; then
  echo "usage: _ops/bin/ops_run.sh <command...>"
  exit 64
fi

ts="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p _ops/logs
base="$(echo "$1" | sed 's#[^a-zA-Z0-9._-]#_#g')"
log="_ops/logs/${base}_${ts}.log"
: > "$log"

hold_on_exit
pulse_start

# شغّل الأمر مع tee مع الحفاظ على كود الخروج
(set -o pipefail; "$@" 2>&1 | tee -a "$log"; exit ${PIPESTATUS[0]})

rc=$?
pulse_stop

echo
echo "---- LOG: $log"
echo "---- Last Acceptance (if any):"
print_accept "$log" || true

echo
hold_here "انتهى التنفيذ. اضغط Enter لإغلاق الجلسة"
exit "$rc"
