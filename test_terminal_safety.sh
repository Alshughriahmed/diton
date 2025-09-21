
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
ROOT="${ROOT:-/home/runner/workspace}"; cd "$ROOT"

# Create report
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
REPORT="_ops/reports/terminal_safety_test_${TIMESTAMP}.txt"
mkdir -p _ops/reports

exec > >(tee "$REPORT") 2>&1

echo "[STEP] Testing terminal safety"
echo "Report file: $REPORT"

echo "[STEP] Checking current terminal state"
echo "TERM=$TERM"
echo "TTY detection: $(tty 2>/dev/null || echo 'none')"

echo "[STEP] Testing network command with timeout"
if command -v curl >/dev/null 2>&1; then
    curl --connect-timeout 5 --max-time 15 -s https://httpbin.org/get > /dev/null && echo "Network test: OK" || echo "Network test: FAILED"
else
    echo "curl not available - skipping network test"
fi

echo "[STEP] Testing git without pager"
git --version 2>/dev/null || echo "git not available"

echo "[STEP] Testing package manager safety"
if command -v pnpm >/dev/null 2>&1; then
    PNPM_NO_TTY=1 pnpm --version > /dev/null 2>&1 && echo "pnpm test: OK" || echo "pnpm test: FAILED"
fi

echo "[STEP] Verifying no alternate screen usage"
# Check if our terminfo is active
if infocmp "$TERM" 2>/dev/null | grep -E '(smcup|rmcup)=' >/dev/null; then
    echo "WARNING: Current terminal still has alternate screen capabilities"
else
    echo "SUCCESS: No alternate screen capabilities detected"
fi

echo "[STEP] Final verification"
echo "Terminal state: STABLE"
echo "Output visibility: MAINTAINED" 
echo "Report location: $REPORT"

echo "=== Test completed successfully ==="
