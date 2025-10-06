#!/usr/bin/env bash
set -Eeuo pipefail
export TERM=dumb CI=1
export PAGER=cat GIT_PAGER=cat LESS='-RFX'
# no-op for CI; avoid alt screen if TTY tools exist
if command -v tput >/dev/null 2>&1; then
  { tput rmcup || true; } 2>/dev/null || true
fi
