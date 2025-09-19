#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
F="src/app/chat/rtcFlow.ts"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/E2_rtcflow_${TS}.ts"
mkdir -p _ops/backups _ops/reports
cp -a "$F" "$BK"

# 1) أضف الحقل للواجهة إن غاب
perl -0777 -i -pe '
  my $c=$_; 
  if ($c !~ /interface\s+RtcState\s*{[^}]*\bremoteStream\b/s){
    $c =~ s/(interface\s+RtcState\s*\{\s*)/$1  remoteStream: MediaStream | null;\n/s;
  }
  $_=$c;
' "$F"

# 2) أضف التهيئة الابتدائية إن غابت
perl -0777 -i -pe '
  my $c=$_; 
  if ($c !~ /let\s+state:\s*RtcState\s*=\s*\{[^}]*\bremoteStream\b/s){
    $c =~ s/(let\s+state:\s*RtcState\s*=\s*\{\s*)/$1  remoteStream: null,\n/s;
  }
  $_=$c;
' "$F"

# 3) بناء للتحقق
set +e
BUILD_LOG="_ops/reports/build_$(date -u +%Y%m%d-%H%M%S).log"
pnpm -s build >"$BUILD_LOG" 2>&1
RC=$?
set -e

echo "-- Acceptance --"
echo "TS_REMOTE_FIELD_ADDED=$([ "$(grep -c 'remoteStream: MediaStream | null;' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "TS_STATE_INIT_ADDED=$([ "$(grep -c 'remoteStream: null' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BUILD_OK=$([ $RC -eq 0 ] && echo 1 || echo 0)"
echo "BACKUP=$BK"
echo "BUILD_LOG=$BUILD_LOG"

if [ $RC -ne 0 ]; then
  echo "-- Build Head --"; sed -n '1,40p' "$BUILD_LOG"
  echo "-- Build Tail --"; tail -n 60 "$BUILD_LOG"
fi
