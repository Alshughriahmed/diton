#!/usr/bin/env bash
set -euo pipefail
echo "## emit/on (كل الملفات)"
grep -Rni --include='*.{ts,tsx}' -E '\bemit\(|\bon\(' src 2>/dev/null || true
echo "## أحداث next/prev بالاسم"
grep -Rni --include='*.{ts,tsx}' -E 'ui:next|ui:prev' src 2>/dev/null || true
echo "## استخدام useNextPrev"
grep -Rni --include='*.{ts,tsx}' 'useNextPrev' src 2>/dev/null || true
echo "## استدعاءات match/next"
grep -Rni --include='*.{ts,tsx}' '/api/match/next' src 2>/dev/null || true
