#!/usr/bin/env bash
. _ops/bin/disable_alt_screen.sh || true
set -Eeuo pipefail
export TERM=dumb CI=1
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BK="_ops/backups/phaseE_${STAMP}.tar"
RPT="_ops/reports/phaseE_ui_wire_${STAMP}.log"
mkdir -p "${BK%/*}" "${RPT%/*}"

# 0) نسخة احتياطية Minimal-Diff
tar -cf "$BK" \
  src/app/chat/ChatClient.tsx \
  src/app/chat/components/ChatToolbar.tsx \
  2>/dev/null || true

# 1) حقن ملف واجهة: peerMetaUi.client.ts
PM="src/app/chat/peerMetaUi.client.ts"
mkdir -p "${PM%/*}"
cat > "$PM" <<'EOF'
"use client";
(() => {
  if (typeof window === "undefined") return;
  if ((window as any).__peerMetaUiInit) return;
  (window as any).__peerMetaUiInit = 1;

  const apply = (m:any) => {
    try {
      (window as any).__ditonaPeerMeta = m || null;
      // يعاد بثّه لواجهة React (اختياري للاستماع داخليًا)
      window.dispatchEvent(new CustomEvent("ditona:peer-meta-ui",{detail:m||null}));
    } catch {}
  };

  // استقبل meta من جسر الـDC
  window.addEventListener("ditona:peer-meta", (e:any)=> apply(e?.detail));
  // عند تصفير الزوج (stop/rematch) نظّف الحالة
  window.addEventListener("rtc:pair", (e:any) => {
    const d = e?.detail || {};
    if (!d?.pairId) apply(null);
  });
})();
EOF

# 2) تأكيد استيراده في ChatClient.tsx
CHAT="src/app/chat/ChatClient.tsx"
ok_client=0
if [ -f "$CHAT" ]; then
  if ! grep -q 'peerMetaUi.client' "$CHAT"; then
    tmp="$(mktemp)"
    # بعد أول أسطر "use client" والاستيرادات العلوية
    awk '
      NR==1{print; next}
      NR==2 && $0!~/use client/ {print} 
      {print}
    ' "$CHAT" > "$tmp"
    mv "$tmp" "$CHAT"
    # ضع الاستيراد بعد metaInit/client إن وجِد
    sed -i '1,40{
      /metaInit\.client/ a import "@/app/chat/peerMetaUi.client";
    }' "$CHAT" || true
    # وإن لم يوجد سطر metaInit، أضف عند الرأس
    if ! grep -q 'peerMetaUi.client' "$CHAT"; then
      sed -i '1 i import "@/app/chat/peerMetaUi.client";' "$CHAT"
    fi
  fi
  grep -q 'peerMetaUi.client' "$CHAT" && ok_client=1 || true
fi

# 3) تفعيل Prev/Filters/Beauty عند isFFA() || isVip
TB="src/app/chat/components/ChatToolbar.tsx"
ok_toolbar=0
if [ -f "$TB" ]; then
  # أضف استيراد isFFA إن لزم
  grep -q 'from "@/utils/ffa"' "$TB" || sed -i '1 i import { isFFA } from "@/utils/ffa";' "$TB"
  # طبّق OR منطقي حيث تستعمل isVip فقط (Minimal replacement)
  sed -i 's/\bisVip\b/(isFFA() || isVip)/g' "$TB"
  # قبول: وجود isFFA() داخل الملف
  grep -q 'isFFA()' "$TB" && ok_toolbar=1 || true
fi

# 4) قبول + مراجع
{
  echo "-- Acceptance --"
  echo "BRIDGE_UI_FILE_OK=$( [ -s "$PM" ] && echo 1 || echo 0 )"
  echo "CHATCLIENT_IMPORT_OK=${ok_client}"
  echo "FFA_TOOLBAR_OK=${ok_toolbar}"
  echo "[refs] backup=$BK"
} | tee "$RPT"

echo "[i] Report: $RPT"
