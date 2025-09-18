#!/usr/bin/env bash
set -o pipefail
export TERM=dumb CI=1 NO_COLOR=1 FORCE_COLOR=0 PAGER=cat MANPAGER=cat GIT_PAGER=cat LESS=FRX
export npm_config_yes=true npm_config_fund=false npm_config_audit=false PNPM_PROGRESS=false HUSKY=0
printf '\e[?1049l' 2>/dev/null || true
tput rmcup 2>/dev/null || true
trap 'stty sane 2>/dev/null || true; printf "\e[?1049l\ec" 2>/dev/null || true; tput rmcup 2>/dev/null || true' EXIT

# enforce non-alternate-screen terminfo
export TERMINFO="${ROOT:-/home/runner/workspace}/_ops/terminfo"
export TERM="xterm-noaltscr"
