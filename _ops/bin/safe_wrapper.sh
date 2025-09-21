
#!/usr/bin/env bash
# --- terminal guard (must be first lines) ---
set -Eeuo pipefail
export TERM=dumb CI=1 NO_COLOR=1 FORCE_COLOR=0
export PAGER=cat MANPAGER=cat GIT_PAGER=cat LESS='-R -F -X'
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.pager GIT_CONFIG_VALUE_0=cat
# force leave alt-screen (1049/47) always
__noaltscr(){ printf '\e[?1049l\e[?47l'; }
__noaltscr
trap '__noaltscr' DEBUG
trap '__noaltscr' EXIT
# safe non-TTY exec helper
safe_exec(){ if command -v script >/dev/null 2>&1; then script -qfec "$*" /dev/null 2>&1 | cat; else bash -lc "$*" </dev/null 2>&1 | cat; fi; }
# --- end guard ---

echo "SESSION_GUARD=ON"

[[ $# -ge 1 ]] || { 
    echo "Usage: $0 <script_or_command> [args...]"
    echo "Wraps any script/command with terminal safety"
    exit 1
}

ROOT="${ROOT:-/home/runner/workspace}"; cd "$ROOT"

# Enhanced safety
export VERCEL_CLI_FORCE_NON_TTY=1 PNPM_NO_TTY=1 NPM_CONFIG_NO_UPDATE_NOTIFIER=true HUSKY=0

echo "[STEP] Preparing safe execution environment"

# Create minimal terminfo if needed
if [[ ! -f "_ops/terminfo/safe" ]]; then
    mkdir -p _ops/terminfo
    echo "safe|minimal safe terminal,am,bw,cols#80,lines#24,bel=^G,cr=^M,cud1=^J,ind=^J," | tic -x -o _ops/terminfo - 2>/dev/null || true
fi

export TERMINFO="${PWD}/_ops/terminfo"

echo "[STEP] Executing: $*"

# Create heartbeat
( while true; do echo "[HB] $(date +%H:%M:%S)"; sleep 10; done ) & 
HB_PID=$!
trap "kill $HB_PID 2>/dev/null || true; __noaltscr" EXIT

# Execute safely
timeout 600s bash -c "
    source <(echo 'set -Eeuo pipefail; export TERM=dumb CI=1 NO_COLOR=1 FORCE_COLOR=0')
    $*
" 2>&1 | cat

kill $HB_PID 2>/dev/null || true
echo "[STEP] Execution completed safely"
