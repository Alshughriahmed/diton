#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
TS="$(date -u +%Y%m%d-%H%M%S)"; BK="_ops/backups/C3b_${TS}"; mkdir -p "$BK" _ops/reports
F="src/app/chat/components/ChatMessagingBar.tsx"; [ -f "$F" ] || { echo "MISSING:$F"; exit 2; }
cp -a "$F" "$BK/"

# 1) "use client" إن غاب
head -n1 "$F" | grep -q '"use client"' || sed -i '1i "use client";' "$F"

# 2) import useEffect إن غاب
grep -q 'useEffect' "$F" || sed -i '1i import { useEffect } from "react";' "$F"

# 3) فرض الغلاف الثابت أعلى الأدوات + data-ui
perl -0777 -i -pe '
  my $c = $_;
  # استبدل أي z-70 بـ z-[70]
  $c =~ s/\bz-70\b/z-[70]/g;
  # بعد تعريف المكوّن، التقط أول وسم فتح وعدّل صفاته
  $c =~ s{
    (?:export\s+default\s+function\s+ChatMessagingBar|function\s+ChatMessagingBar|const\s+ChatMessagingBar\s*=\s*\() .*? (\< [A-Za-z][\w-]* \s+ [^>]* \>)
  }{
    my $tag=$1;
    # data-ui
    $tag =~ s/\>$/ data-ui="messages-fixed">/ unless $tag =~ /data-ui\s*=\s*"messages-fixed"/;
    # className="..." أو {`...`}
    if ($tag =~ /className\s*=\s*"/) {
      $tag =~ s/className\s*=\s*"([^"]*)"/'className="' . $1 . ' fixed inset-x-0 bottom-0 z-[70] pointer-events-auto"'/e;
    } elsif ($tag =~ /className\s*=\s*\{\s*`/) {
      $tag =~ s/className\s*=\s*\{\s*`([^`]*)`/ 'className={`' . $1 . ' fixed inset-x-0 bottom-0 z-[70] pointer-events-auto`' /e;
    } elsif ($tag !~ /className=/) {
      $tag =~ s/\>$/ className="fixed inset-x-0 bottom-0 z-[70] pointer-events-auto">/;
    }
    $tag;
  }gsex;
  $_ = $c;
' "$F"

# 4) حقن visualViewport hook صغير إذا غاب
if ! grep -qi 'visualViewport' "$F"; then
  cat >> "$F" <<'TS'
/* vv keyboard lift */
useEffect(()=>{ try{
  const vv = (window as any).visualViewport; if(!vv) return;
  const lift=()=>{ const d=(window.innerHeight - vv.height); document.body.style.setProperty('--kbd-shift', d>0? d+'px':'0px'); };
  vv.addEventListener('resize', lift); lift(); return ()=>vv.removeEventListener('resize', lift);
}catch{} },[]);
TS
fi

echo "-- Acceptance --"
echo "MSG_BAR_Z_OK=$([ "$(grep -c 'z-\[70\]' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "VISUAL_VIEWPORT_OK=$([ "$(grep -ci 'visualViewport' "$F")" -ge 1 ] && echo 1 || echo 0)"
echo "BACKUP_DIR=$BK"
