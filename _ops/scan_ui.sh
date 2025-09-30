set -euo pipefail
echo "== GIT ==" && git log -1 --oneline

echo; echo "== CANDIDATES (messaging bar) =="
grep -RIl --line-number -E 'Chat(Messaging|Messages)|MessagingBar|💬|chat.?message' src || true

echo; echo "== ChatClient.tsx presence =="
ls -l src/app/chat/ChatClient.tsx 2>/dev/null || true

echo; echo "== Toolbar candidates (Next/Prev) =="
grep -RIl --line-number -E 'ChatToolbar|toolbar|Prev|Next' src || true

echo; echo "== CSS globals =="
ls -l src/app/globals.css 2>/dev/null || true
ls -l src/styles/globals.css 2>/dev/null || true

echo; echo "== onPair / pairId bindings (للهيدر/البادجات) =="
grep -RIn --line-number -E 'onPair|pairId|setPair' src/app/chat 2>/dev/null || true
