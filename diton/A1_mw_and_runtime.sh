#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"
BK="_ops/backups/A1_${TS}"; mkdir -p "$BK" _ops/reports
FILES_TOUCHED="_ops/reports/batch_A_files.tmp"; :> "$FILES_TOUCHED"

# 1) middleware.ts: أول سطر داخل middleware() لحماية /api
if [ -f src/middleware.ts ]; then
  cp -a src/middleware.ts "$BK/middleware.ts"
  # ضمان الاستيراد
  grep -q 'from "next/server"' src/middleware.ts || sed -i '1i import { NextResponse } from "next/server";' src/middleware.ts
  # إدراج الحارس كأول سطر داخل الدالة إن لم يوجد
  perl -0777 -pe 'BEGIN{$/=\undef}
    s/(export\s+function\s+middleware\s*\(\s*request:[^{]+{\s*)(?!\s*if\s*\(request\.nextUrl\.pathname\.startsWith\("\/api"\)\)\s*return\s+NextResponse\.next\(\);\s*)/$1  if (request.nextUrl.pathname.startsWith("\/api")) return NextResponse.next();\n/s
  ' -i src/middleware.ts
  echo "src/middleware.ts" >> "$FILES_TOUCHED"
fi

# 2) لكل route.ts تحت /api: runtime=nodejs + dynamic=force-dynamic
mapfile -t API_ROUTES < <(find src/app/api -type f -name route.ts 2>/dev/null || true)
REPLACED_RT=0; REPLACED_DY=0; TOUCHED=0
for f in "${API_ROUTES[@]}"; do
  mkdir -p "$BK/$(dirname "$f")"; cp -a "$f" "$BK/$f"
  # runtime
  if grep -q 'export const runtime' "$f"; then
    perl -0777 -pe 's/export\s+const\s+runtime\s*=\s*["'\'']\w+["'\''];/export const runtime = "nodejs";/g' -i "$f"; ((REPLACED_RT++)) || true
  else
    printf '\nexport const runtime = "nodejs";\n' >> "$f"
  fi
  # dynamic
  if grep -q 'export const dynamic' "$f"; then
    perl -0777 -pe 's/export\s+const\s+dynamic\s*=\s*["'\''][^"'\'']+["'\''];/export const dynamic = "force-dynamic";/g' -i "$f"; ((REPLACED_DY++)) || true
  else
    printf 'export const dynamic = "force-dynamic";\n' >> "$f"
  fi
  echo "$f" >> "$FILES_TOUCHED"
  ((TOUCHED++)) || true
done

# قبول جزئي لهذه الخطوة
echo "-- Acceptance --"
echo "API_MW_BYPASS_SET=$( [ -f src/middleware.ts ] && grep -q 'pathname.startsWith(\"/api\")' src/middleware.ts && echo 1 || echo 0 )"
echo "API_ROUTES_TOUCHED=${TOUCHED}"
echo "RUNTIME_SET=${REPLACED_RT}"
echo "DYNAMIC_SET=${REPLACED_DY}"
echo "BACKUP_DIR=$BK"
