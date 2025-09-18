
#!/usr/bin/env bash
set -euo pipefail
ROOT="${ROOT:-/home/runner/workspace}"; cd "$ROOT"
[ -x _ops/bin/shell_guard.sh ] && source _ops/bin/shell_guard.sh || true
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/01_${TS}"; mkdir -p "$BK"

# 1) middleware.ts: استثناء /api/* مبكّرًا + ضمان الاستيراد
if [ -f src/middleware.ts ]; then
  cp -a src/middleware.ts "$BK/middleware.ts"
  # أضف/ثبّت الاستيراد
  grep -q 'from "next/server"' src/middleware.ts || \
    sed -i '1i import { NextResponse } from "next/server";' src/middleware.ts
  # أضف الحارس إن لم يوجد
  perl -0777 -pe 'BEGIN{$/=\undef}
    s/(export\s+function\s+middleware\s*\(\s*request:[^{]+{\s*)/$1\n  if (request.nextUrl.pathname.startsWith("\/api")) return NextResponse.next();\n/s
    unless(/pathname\.startsWith\("\/api"\)/)
  ' -i src/middleware.ts
fi

# 2) لكل route.ts تحت /api: runtime=nodejs + dynamic=force-dynamic
mapfile -t API_ROUTES < <(find src/app/api -type f -name route.ts 2>/dev/null || true)
TOUCHED=0 REPLACED_RT=0 REPLACED_DY=0
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
  ((TOUCHED++)) || true
done

echo "-- Acceptance --"
echo "API_HTML_LEAK_GUARD=$( [ -f src/middleware.ts ] && grep -q 'pathname.startsWith(\"/api\")' src/middleware.ts && echo 1 || echo 0 )"
echo "API_ROUTES_TOUCHED=${TOUCHED}"
echo "RUNTIME_SET=${REPLACED_RT}"
echo "DYNAMIC_SET=${REPLACED_DY}"
echo "BACKUP_DIR=$BK"
#!/usr/bin/env bash
set -euo pipefail
ROOT="${ROOT:-/home/runner/workspace}"; cd "$ROOT"
[ -x _ops/bin/shell_guard.sh ] && source _ops/bin/shell_guard.sh || true
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/01_${TS}"; mkdir -p "$BK"

# 1) middleware.ts: استثناء /api/* مبكّرًا + ضمان الاستيراد
if [ -f src/middleware.ts ]; then
  cp -a src/middleware.ts "$BK/middleware.ts"
  # أضف/ثبّت الاستيراد
  grep -q 'from "next/server"' src/middleware.ts || \
    sed -i '1i import { NextResponse } from "next/server";' src/middleware.ts
  # أضف الحارس إن لم يوجد
  perl -0777 -pe 'BEGIN{$/=\undef}
    s/(export\s+function\s+middleware\s*\(\s*request:[^{]+{\s*)/$1\n  if (request.nextUrl.pathname.startsWith("\/api")) return NextResponse.next();\n/s
    unless(/pathname\.startsWith\("\/api"\)/)
  ' -i src/middleware.ts
fi

# 2) لكل route.ts تحت /api: runtime=nodejs + dynamic=force-dynamic
mapfile -t API_ROUTES < <(find src/app/api -type f -name route.ts 2>/dev/null || true)
TOUCHED=0 REPLACED_RT=0 REPLACED_DY=0
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
  ((TOUCHED++)) || true
done

echo "-- Acceptance --"
echo "API_HTML_LEAK_GUARD=$( [ -f src/middleware.ts ] && grep -q 'pathname.startsWith(\"/api\")' src/middleware.ts && echo 1 || echo 0 )"
echo "API_ROUTES_TOUCHED=${TOUCHED}"
echo "RUNTIME_SET=${REPLACED_RT}"
echo "DYNAMIC_SET=${REPLACED_DY}"
echo "BACKUP_DIR=$BK"
