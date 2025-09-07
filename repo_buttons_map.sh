#!/usr/bin/env bash
set -euo pipefail
echo "## Chat toolbar & controls"
grep -Rni --include='*.tsx' -E 'aria-label=' src/app/chat src/components/chat 2>/dev/null || true
echo "## gesture-layer"
grep -n 'id="gesture-layer"' src/app/chat/ChatClient.tsx 2>/dev/null || true
sed -n '1,220p' src/app/chat/ChatClient.tsx | nl -ba | sed -n '150,190p' 2>/dev/null || true
