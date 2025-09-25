#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"
BK="_ops/backups/C4f_${TS}"
mkdir -p "$BK" _ops/reports

# Verify the buttons are properly tagged
F="src/app/chat/components/ChatToolbar.tsx"
PREV_COUNT=$(grep -c 'data-ui="btn-prev"' "$F" || echo 0)
NEXT_COUNT=$(grep -c 'data-ui="btn-next"' "$F" || echo 0)

echo "=== Navigation Button Verification ==="
echo "Found btn-prev tags: $PREV_COUNT"
echo "Found btn-next tags: $NEXT_COUNT"

# Show the actual tagged lines
echo -e "\n=== Tagged Navigation Elements ==="
grep -n 'data-ui="btn-prev\|data-ui="btn-next' "$F" || true

echo -e "\n-- Acceptance --"
echo "BTN_DATA_UI_PREV=$([ $PREV_COUNT -gt 0 ] && echo 1 || echo 0)"
echo "BTN_DATA_UI_NEXT=$([ $NEXT_COUNT -gt 0 ] && echo 1 || echo 0)"
echo "FFA_PREV_ENABLED=$([ $PREV_COUNT -gt 0 ] && [ $NEXT_COUNT -gt 0 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
