. _ops/bin/disable_alt_screen.sh || true
#!/usr/bin/env bash
set -Eeuo pipefail
export TERM=dumb CI=1 FORCE_COLOR=0 NO_COLOR=1
export LESS='-XFR'
stty sane 2>/dev/null || true
tput rmcup 2>/dev/null || true
trap 'stty sane 2>/dev/null || true; tput rmcup 2>/dev/null || true; printf "\ec"' EXIT
# اجعل vercel/pnpm غير تفاعليين
export VERCEL_CLI_FORCE_NON_TTY=1
alias less='less -XFR'
