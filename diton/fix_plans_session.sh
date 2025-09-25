#!/usr/bin/env bash
set -Eeuo pipefail
TS="$(date +%Y%m%d-%H%M%S)"
BK="_ops/backups/fix_plans_session_$TS"; mkdir -p "$BK/src/components/providers" "$BK/src/app" "$BK/src/components"

LAYOUT="src/app/layout.tsx"
HEADER="src/components/HeaderLite.tsx"

# نسخ احتياطي
[ -f "$LAYOUT" ] && install -D "$LAYOUT" "$BK/$LAYOUT" || true
[ -f "$HEADER" ] && install -D "$HEADER" "$BK/$HEADER" || true

# 1) مزوّد الجلسة (عميل)
install -D /dev/stdin src/components/providers/SessionProviderClient.tsx <<'EOF'
"use client";
import { SessionProvider } from "next-auth/react";
export default function SessionProviderClient({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
EOF

# 2) لفّ <body> بالمزوّد في layout.tsx
if [ -f "$LAYOUT" ]; then
  grep -q 'SessionProviderClient' "$LAYOUT" || sed -i '1i import SessionProviderClient from "@/components/providers/SessionProviderClient";' "$LAYOUT"
  grep -q '<SessionProviderClient>' "$LAYOUT" || sed -i "0,/<body[^>]*>/s//&\n        <SessionProviderClient>/" "$LAYOUT"
  grep -q '</SessionProviderClient>' "$LAYOUT" || sed -i "0,/<\/body>/s//        <\/SessionProviderClient>\n      &/" "$LAYOUT"
fi

# 3) جعل useSession آمنًا وإزالة التكرارات في HeaderLite.tsx
if [ -f "$HEADER" ]; then
  # إزالة أي تفكيك مباشر مكرر
  perl -0777 -pe "s/\s*const\s*\{\s*data:\s*session\s*\}\s*=\s*useSession\(\);\s*//g" -i "$HEADER"
  # إضافة استدعاء آمن إن لم يكن موجودًا
  grep -q "_u = (useSession as any)" "$HEADER" || \
  sed -i "/export default function HeaderLite.*{/a\  const _u = (useSession as any)?.();\n  const session = _u?.data ?? null;" "$HEADER"
fi

echo "-- Acceptance --"
echo "ADDED_SPC_FILE=1"
echo "LAYOUT_WRAPPED=$(grep -q "SessionProviderClient" "$LAYOUT" && echo 1 || echo 0)"
echo "HEADER_SAFE_USESESSION=$(grep -q "_u\\s*=\\s*(useSession as any)" "$HEADER" && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
echo "-- End Acceptance --"
