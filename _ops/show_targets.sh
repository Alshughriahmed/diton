set -euo pipefail
targets=(
  src/app/chat/components/ChatMessagingBar.tsx
  src/app/chat/ChatClient.tsx
  src/app/chat/components/ChatToolbar.tsx
  src/components/chat/ChatToolbar.tsx
  src/components/chat/ChatMessaging.tsx
  src/components/chat/ChatMessages.tsx
  src/styles/globals.css
  src/app/globals.css
  src/utils/events.ts
)
for f in "${targets[@]}"; do
  echo; echo "=== FILE: $f ==="
  if [ -f "$f" ]; then nl -ba "$f" | sed -n '1,240p'; else echo "(missing)"; fi
done
