#!/usr/bin/env bash
set -euo pipefail

# Force safe terminal environment
export TERMINFO="${ROOT:-/home/runner/workspace}/_ops/terminfo"
export TERM="dumb-safe"
export CI=1 NO_COLOR=1 FORCE_COLOR=0 
export PAGER=cat MANPAGER=cat GIT_PAGER=cat LESS=FRX
export npm_config_yes=true npm_config_fund=false npm_config_audit=false 
export PNPM_PROGRESS=false HUSKY=0

# Disable TTY for common tools
export VERCEL_CLI_FORCE_NON_TTY=1
export PNPM_NO_TTY=1
export NPM_CONFIG_NO_UPDATE_NOTIFIER=true

# Force exit from any alternate screen
printf '\e[?1049l\e[2J\e[H' 2>/dev/null || true
stty sane 2>/dev/null || true

# Set trap for cleanup
trap 'stty sane 2>/dev/null || true; printf "\e[?1049l\e[2J\e[H\ec" 2>/dev/null || true' EXIT INT TERM

# Execute command through script to eliminate TTY detection
if command -v script >/dev/null 2>&1; then
    script -qfec "$*" /dev/null 2>&1 || true
else
    # Fallback: redirect stdin and force non-interactive
    bash -c "$*" </dev/null 2>&1 || true
fi
