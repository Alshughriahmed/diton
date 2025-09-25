#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://${REPLIT_DEV_DOMAIN:-}}"
[[ -z "$BASE" ]] && { echo "✖ BASE URL غير معروف. مرّر العنوان مثل: bash _ops/diag_ui.sh https://your-repl.replit.dev"; exit 1; }
echo "→ BASE = $BASE"

echo -e "\n=== (A) رؤوس الصفحة /chat ==="
curl -sI "$BASE/chat" | awk 'BEGIN{IGNORECASE=1}/content-security-policy|permissions-policy|strict-transport-security|x-frame-options|referrer-policy|location/'

echo -e "\n=== (B) أول 60 سطر HTML من /chat ==="
HTML="$(mktemp)"; curl -s "$BASE/chat" | tee "$HTML" | sed -n '1,60p' || true

echo -e "\n=== (C) روابط CSS/JS التي يعتمدها /chat وحالة تحميلها ==="
# التقط روابط _next للـ CSS/JS
grep -Eo 'href="[^"]+/_next/[^"]+\.css"|src="[^"]+/_next/[^"]+\.js"' "$HTML" | sed 's/^href=//;s/^src=//;s/"//g' | while read -r url; do
  # أكمل الرابط إن كان نسبيًا
  [[ "$url" =~ ^https?:// ]] || url="$BASE${url}"
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  echo "• $url  →  $code"
done

echo -e "\n=== (D) فحص CSP في الكود ==="
if [ -f next.config.js ]; then
  echo "— next.config.js:"
  sed -n '1,200p' next.config.js | nl | sed -n '1,120p' | awk 'BEGIN{IGNORECASE=1}/Content-Security-Policy|style-src|script-src|connect-src|frame-src|twilio|stripe|hcaptcha|global.turn/ {print}'
else
  echo "لا يوجد next.config.js هنا."
fi

echo -e "\n=== (E) تأكيد استيراد CSS العام ==="
LAYOUT=$(rg -n --hidden --no-ignore 'layout\.tsx' src || true)
echo "ملف layout.tsx: $LAYOUT"
rg -n --hidden --no-ignore "globals\.css" ${LAYOUT%%:*} || echo "✖ لم أجد import 'globals.css' في layout.tsx"

echo -e "\n=== (F) لقطات سريعة للبِلْد ==="
if command -v pnpm >/dev/null 2>&1; then
  pnpm -s -C . -w ls >/dev/null 2>&1 || true
fi
echo "TypeScript/ESLint أخطاء إن وجدت:"
rg -n "TypeError|ReferenceError|window is not defined|hydration|CSP|Refused to" .next 2>/dev/null || true
