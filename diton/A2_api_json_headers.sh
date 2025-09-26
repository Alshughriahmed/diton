#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"
BK="_ops/backups/A2_${TS}"; mkdir -p "$BK" _ops/reports
FILES_TOUCHED="_ops/reports/batch_A_files.tmp"

# استهدف فقط REST الحساسة
mapfile -t TARGETS < <(printf '%s\n' \
  "src/app/api/rtc" \
  "src/app/api/monitoring/metrics" \
  | xargs -I{} bash -lc 'find "{}" -type f -name route.ts 2>/dev/null' || true)

PATCHED=0
for f in "${TARGETS[@]}"; do
  [ -f "$f" ] || continue
  mkdir -p "$BK/$(dirname "$f")"; cp -a "$f" "$BK/$f"

  # أضف مُغلّف jsonNoStore إن لم يكن موجودًا
  grep -q 'function jsonNoStore' "$f" || sed -i '1i import { NextResponse } from "next/server";\nconst jsonNoStore=(d:any,i?:ResponseInit)=>NextResponse.json(d,{...(i||{}),headers:{...((i&&i.headers)||{}), "Cache-Control":"no-store"}});\n' "$f"

  # استبدل NextResponse.json بـ jsonNoStore
  perl -0777 -pe 's/\bNextResponse\.json\s*\(/jsonNoStore(/g' -i "$f" || true

  # ضمان استخدام Cache-Control فقط هنا؛ لا نفرض Content-Type على مسارات غير JSON مستقبلًا
  echo "$f" >> "$FILES_TOUCHED"
  ((PATCHED++)) || true
done

echo "-- Acceptance --"
echo "API_JSON_NOCACHE_TOUCHED=${PATCHED}"
echo "BACKUP_DIR=$BK"
