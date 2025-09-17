set -euo pipefail
hold_begin(){ trap 'stty sane 2>/dev/null || true' EXIT; stty sane 2>/dev/null || true; }
pulse_start(){ ( while :; do printf "."; sleep 1; done ) & export PULSE_PID=$!; }
pulse_stop(){ [ -n "${PULSE_PID:-}" ] && kill "$PULSE_PID" 2>/dev/null || true; echo; }
