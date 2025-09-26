#!/usr/bin/env bash
set -euo pipefail
echo "## emits"
grep -Rni --include='*.{ts,tsx}' 'emit("ui:next' src 2>/dev/null || true
grep -Rni --include='*.{ts,tsx}' 'emit("ui:prev' src 2>/dev/null || true
echo "## on(listeners)"
grep -Rni --include='*.{ts,tsx}' 'on("ui:next' src 2>/dev/null || true
grep -Rni --include='*.{ts,tsx}' 'on("ui:prev' src 2>/dev/null || true
echo "## match/next fetch usage"
grep -Rni --include='*.{ts,tsx}' '/api/match/next' src 2>/dev/null || true
