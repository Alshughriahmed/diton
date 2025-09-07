#!/usr/bin/env bash
set -euo pipefail

echo "# State store existence"
ls -l src/state/filters.ts || true

echo "# ChatClient uses local state for gender/countries?"
grep -nE 'useState<.*Gender|useState<.*string.*countries|setFilters\(|getFilters\(' -n src/app/chat/ChatClient.tsx || true

echo "# Components import/use useFilters"
grep -Rni --include='*.tsx' 'useFilters\(' src/components src/app 2>/dev/null || true

echo "# Direct localStorage access for filters (should be none if unified)"
grep -Rni --include='*.{ts,tsx}' -E 'localStorage\.(get|set)Item\(.?filters' src 2>/dev/null || true

echo "# Filter UI files present"
ls -l src/components/filters 2>/dev/null || true
