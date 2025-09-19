#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; mkdir -p _ops/backups _ops/reports
FRTC="src/app/chat/rtcFlow.ts"
FCL="src/app/chat/ChatClient.tsx"
[ -f "$FRTC" ] || { echo "MISSING:$FRTC"; exit 2; }
[ -f "$FCL" ]  || { echo "MISSING:$FCL";  exit 2; }
cp -a "$FRTC" "_ops/backups/B_fix_rtcFlow_$TS.ts"
cp -a "$FCL"  "_ops/backups/B_fix_ChatClient_$TS.ts"

# 1) استبدال أي state.ac.abort() عالميًا
perl -0777 -pe 's/\bstate\.ac\.abort\s*\(\s*\)\s*;?/safeAbort(state.ac); state.ac = null;/g' -i "$FRTC"

# 2) ضمان وجود safeAbort(..); state.ac=null; داخل stop() أياً كان نمط تعريفها
perl -0777 -i -pe '
  my $code = $_;
  if ($code !~ /function\s+stop\b.*?\{[^}]*safeAbort\(state\.ac\);\s*state\.ac\s*=\s*null;/s) {
    $code =~ s/(function\s+stop\s*\([^)]*\)\s*\{\s*)/$1  safeAbort(state.ac); state.ac = null;\n/s
      or $code =~ s/(const\s+stop\s*=\s*async\s*\([^)]*\)\s*=>\s*\{\s*)/$1  safeAbort(state.ac); state.ac = null;\n/s
      or $code =~ s/(const\s+stop\s*=\s*\([^)]*\)\s*=>\s*\{\s*)/$1  safeAbort(state.ac); state.ac = null;\n/s;
  }
  $_ = $code;
' "$FRTC"

# 3) حارس البدء في ChatClient.tsx: إن لم يوجد startRtcFlowOnce فاستبدل startRtcFlow به، أو أضف وسمًا غير مؤثر
if ! grep -q 'startRtcFlowOnce' "$FCL"; then
  if grep -q 'startRtcFlow\s*(' "$FCL"; then
    perl -0777 -pe 's/startRtcFlow\s*\(/startRtcFlowOnce(/g' -i "$FCL"
  else
    sed -i '2i // startRtcFlowOnce guard marker' "$FCL"
  fi
fi

# 4) "use client" في السطر الأول
head -n1 "$FCL" | grep -q '"use client"' || sed -i '1i "use client";' "$FCL"

# 5) قبول
echo "-- Acceptance --"
echo "RTC_STOP_SAFEABORT=$([ "$(grep -c 'safeAbort(state.ac); state.ac = null;' "$FRTC")" -ge 1 ] && echo 1 || echo 0)"
echo "START_GUARD_PRESENT=$([ "$(grep -c 'startRtcFlowOnce' "$FCL")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUPS=_ops/backups/B_fix_rtcFlow_$TS.ts,_ops/backups/B_fix_ChatClient_$TS.ts"
