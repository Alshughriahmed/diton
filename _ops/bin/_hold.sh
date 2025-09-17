set -euo pipefail
export LANG=C LC_ALL=C
export TERM=dumb LESS=FRX PAGER=cat GIT_PAGER=cat MANPAGER=cat NODE_PAGER=cat
stty sane 2>/dev/null || true
printf '\e[?1049l' 2>/dev/null || true
tput rmcup 2>/dev/null || true

hold_begin() {
  trap 'stty sane 2>/dev/null; printf "\e[?1049l" 2>/dev/null; tput rmcup 2>/dev/null; tput cnorm 2>/dev/null || true' EXIT
}

pulse_start(){ ( while :; do printf "."; sleep 1; done ) & export PULSE_PID=$!; }
pulse_stop(){ [ -n "${PULSE_PID:-}" ] && kill "$PULSE_PID" 2>/dev/null || true; echo; }
