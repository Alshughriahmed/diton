#!/usr/bin/env bash
set -euo pipefail

hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

cooldown=$(grep -q 'lastTsRef' src/app/chat/ChatClient.tsx && echo true || echo false)
gesture=$(grep -q 'id="gesture-layer"' src/app/chat/ChatClient.tsx && grep -q -- '-z-10' src/app/chat/ChatClient.tsx && echo true || echo false)
filters=$(grep -q 'useFilters' src/app/chat/ChatClient.tsx && echo "useFilters" || echo "local")

apis=$(find src/app/api -type f -name route.ts | sort | sed 's|src/app||')
pages=$(find src/app -maxdepth 1 -type d -not -path "*/api/*" | sed 's|src/app||' | sort)
toolbar=$(grep -Rni --include='*.tsx' 'aria-label=' src/components src/app 2>/dev/null | wc -l | tr -d ' ')

jq -n \
  --arg git "$hash" \
  --arg filters "$filters" \
  --argjson cooldown "$cooldown" \
  --argjson gesture "$gesture" \
  --argjson toolbar "$toolbar" \
  --arg apis "$(printf '%s\n' $apis | jq -R . | jq -s .)" \
  --arg pages "$(printf '%s\n' $pages | jq -R . | jq -s .)" \
  '{
    repo:{
      git:$git,
      filters_source:$filters,
      cooldown_700ms:$cooldown,
      gesture_layer_has_neg_z:$gesture,
      api_routes:$apis,
      pages:$pages,
      toolbar_buttons:$toolbar
    }
  }'
