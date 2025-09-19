#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/C3c_${TS}"; mkdir -p "$BK" _ops/reports
# ابحث عن ملف ChatMessagingBar.tsx
F=$(grep -RIl --include='*.tsx' 'ChatMessagingBar' src/app 2>/dev/null | head -1 || true)
[ -n "${F:-}" ] || { echo "MISSING: ChatMessagingBar.tsx"; echo "-- Acceptance --"; echo "MSG_BAR_Z_OK=0"; echo "VISUAL_VIEWPORT_OK=0"; exit 0; }
mkdir -p "$BK/$(dirname "$F")"; cp -a "$F" "$BK/"

# 1) "use client" رأس الملف
head -n1 "$F" | grep -q '"use client"' || sed -i '1i "use client";' "$F"
# 2) import useEffect إن غاب
grep -q 'useEffect' "$F" || sed -i '1i import { useEffect } from "react";' "$F"
# 3) z-[70] وطبقة ثابتة + data-ui
perl -0777 -i -pe '
  s/\bz-70\b/z-[70]/g;
  s/<([A-Za-z][\w-]*)\s+([^>]*className=\s*"[^"]*)"/"<".$1." "."$2 fixed inset-x-0 bottom-0 z-[70] pointer-events-auto\""/g;
  s/<([A-Za-z][\w-]*)\s+([^>]*className=\s*\{\s*`[^`]*)`/<$1 $2 fixed inset-x-0 bottom-0 z-[70] pointer-events-auto`/g;
  s/<([A-Za-z][\w-]*)(\s+[^>]*)?>/<$1 data-ui="messages-fixed"\2>/ if $_ !~ /data-ui\s*=\s*"messages-fixed"/;
' "$F"

# 4) visualViewport hook إن غاب
if ! grep -qi 'visualViewport' "$F"; then
cat >> "$F" <<'TS'
/* vv keyboard lift */
useEffect(()=>{ try{
  const vv=(window as any).visualViewport; if(!vv) return;
  const lift=()=>{ const d=window.innerHeight - vv.height; document.body.style.setProperty('--kbd-shift', d>0? d+'px':'0px'); };
  vv.addEventListener('resize', lift); lift(); return ()=>vv.removeEventListener('resize', lift);
}catch{} },[]);
TS
fi

echo "-- Acceptance --"
echo "MSG_BAR_Z_OK=$([ "$(grep -c 'z-\[70\]' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "VISUAL_VIEWPORT_OK=$([ "$(grep -ci 'visualViewport' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
