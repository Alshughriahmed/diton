#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C TERM=dumb
cd /home/runner/workspace

HAS_HELPER=0
grep -qE 'export[[:space:]]+async[[:space:]]+function[[:space:]]+likeApiThenDc' src/app/chat/likeSyncClient.ts && HAS_HELPER=1

USE_IN_CLIENT=$(grep -RIn --exclude-dir=_archive --exclude-dir=.next --exclude-dir=node_modules -E '\blikeApiThenDc\(' src/app/chat/ChatClient.tsx 2>/dev/null | wc -l | tr -d ' ')
USE_IN_LIKESYS=$(grep -RIn --exclude-dir=_archive --exclude-dir=.next --exclude-dir=node_modules -E '\blikeApiThenDc\(' src/components/chat/LikeSystem.tsx 2>/dev/null | wc -l | tr -d ' ' || true)

REMAIN_FETCH=$(grep -RIn --exclude-dir=_archive --exclude-dir=.next --exclude-dir=node_modules -E '\bfetch\(' src 2>/dev/null | grep '/api/like' | wc -l | tr -d ' ')

OUT="$(mktemp)"; BUILD=FAIL
pnpm -s build >"$OUT" 2>&1 || true
grep -q "Compiled successfully" "$OUT" && BUILD=OK

printf "%s\n" \
"-- Acceptance --" \
"STEP=P6_VERIFY" \
"HAS_HELPER=${HAS_HELPER}" \
"USE_IN_CLIENT=${USE_IN_CLIENT}" \
"USE_IN_LikeSystem=${USE_IN_LIKESYS}" \
"REMAINING_FETCH_API_LIKE=${REMAIN_FETCH}" \
"BUILD=${BUILD}" \
"-- /Acceptance --"

if [ "$BUILD" != "OK" ]; then
  awk "/Type error:|Syntax Error/,0" "$OUT" | sed -n "1,200p"
fi
#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C TERM=dumb
cd /home/runner/workspace

HAS_HELPER=0
grep -qE 'export[[:space:]]+async[[:space:]]+function[[:space:]]+likeApiThenDc' src/app/chat/likeSyncClient.ts && HAS_HELPER=1

USE_IN_CLIENT=$(grep -RIn --exclude-dir=_archive --exclude-dir=.next --exclude-dir=node_modules -E '\blikeApiThenDc\(' src/app/chat/ChatClient.tsx 2>/dev/null | wc -l | tr -d ' ')
USE_IN_LIKESYS=$(grep -RIn --exclude-dir=_archive --exclude-dir=.next --exclude-dir=node_modules -E '\blikeApiThenDc\(' src/components/chat/LikeSystem.tsx 2>/dev/null | wc -l | tr -d ' ' || true)

REMAIN_FETCH=$(grep -RIn --exclude-dir=_archive --exclude-dir=.next --exclude-dir=node_modules -E '\bfetch\(' src 2>/dev/null | grep '/api/like' | wc -l | tr -d ' ')

OUT="$(mktemp)"; BUILD=FAIL
pnpm -s build >"$OUT" 2>&1 || true
grep -q "Compiled successfully" "$OUT" && BUILD=OK

printf "%s\n" \
"-- Acceptance --" \
"STEP=P6_VERIFY" \
"HAS_HELPER=${HAS_HELPER}" \
"USE_IN_CLIENT=${USE_IN_CLIENT}" \
"USE_IN_LikeSystem=${USE_IN_LIKESYS}" \
"REMAINING_FETCH_API_LIKE=${REMAIN_FETCH}" \
"BUILD=${BUILD}" \
"-- /Acceptance --"

if [ "$BUILD" != "OK" ]; then
  awk "/Type error:|Syntax Error/,0" "$OUT" | sed -n "1,200p"
fi
