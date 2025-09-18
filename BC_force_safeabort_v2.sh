#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; mkdir -p _ops/backups _ops/reports
F="src/app/chat/rtcFlow.ts"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "_ops/backups/B_force_safeabort_${TS}.ts"

# 1) استبدال أي استدعاء مباشر لـ abort()
perl -0777 -pe 's/\bstate\.ac\.abort\s*\(\s*\)\s*;?/safeAbort(state.ac); state.ac = null;/g' -i "$F"

# 2) ضمان حقن safeAbort داخل stop() أياً كان شكلها (function/const/arrow/method)
perl -0777 -i -pe '
  my $code = $_; my $injected = 0;

  # نمط: function stop(...) { ... }
  $injected ||= ($code =~ s/(?:^|\n)(\s*(?:export\s+)?function\s+stop\s*\([^)]*\)\s*\{\s*)/$1  safeAbort(state.ac); state.ac = null;\n/s);

  # نمط: const stop = async (...) => { ... } أو const stop = (...) => { ... }
  $injected ||= ($code =~ s/(?:^|\n)(\s*const\s+stop\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{\s*)/$1  safeAbort(state.ac); state.ac = null;\n/s);

  # نمط: stop(...) { ... } كـ method داخل كائن/صنف
  $injected ||= ($code =~ s/(?:^|\n)(\s*stop\s*\([^)]*\)\s*\{\s*)/$1  safeAbort(state.ac); state.ac = null;\n/s);

  $_ = $code;
' "$F"

# 3) تحقق: السطر موجود داخل stop()
HAVE=$(perl -0777 -ne 'if(/stop\s*\([^)]*\)\s*\{\s*[^}]*?safeAbort\(state\.ac\);\s*state\.ac\s*=\s*null;/s){print 1}else{print 0}' "$F")

echo "-- Acceptance --"
echo "RTC_STOP_SAFEABORT=$HAVE"
echo "BACKUP=_ops/backups/B_force_safeabort_${TS}.ts"

# 4) عند الفشل اطبع سياق stop() للمساعدة
if [ "$HAVE" -ne 1 ]; then
  echo "-- Context(stop) --"
  nl -ba "$F" | awk \'/stop\\s*\\(/ {s=NR-5} s&&NR<=s+80{print} END{if(!s) print "STOP_NOT_FOUND"}\'
fi
