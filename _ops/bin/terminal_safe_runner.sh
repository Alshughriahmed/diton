#!/usr/bin/env bash
# terminal_safe_runner.sh - Safe terminal script runner with no alt screen
set -Eeuo pipefail
export TERM=dumb CI=1 NO_COLOR=1 FORCE_COLOR=0
export PAGER=cat MANPAGER=cat GIT_PAGER=cat LESS='-R -F -X'
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.pager GIT_CONFIG_VALUE_0=cat

# Disable alt screen
__noaltscr(){ printf '\e[?1049l\e[?47l'; }
__noaltscr; trap '__noaltscr' DEBUG; trap '__noaltscr' EXIT INT TERM

# Execute the provided script safely
if [ $# -gt 0 ]; then
    exec bash "$@"
else
    echo "Usage: $0 <script_to_run> [args...]"
    exit 1
fi