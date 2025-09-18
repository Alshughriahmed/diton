. _ops/bin/disable_alt_screen.sh || true
set -euo pipefail
TS=$(date -u +%Y%m%d-%H%M%S)
BK="_ops/backups/msgbar_min_${TS}"; REP="_ops/reports/msgbar_min_${TS}.log"
mkdir -p "$BK" _ops/reports
F=src/app/chat/components/ChatMessagingBar.tsx
test -f "$F"; install -D "$F" "$BK/$F"

# 1) أضف data-ui للعنصر الخارجي إن غاب
perl -0777 -i -pe 's@(<div\s+ref=\{ref\}\s+)([^>]*?)>@ ($2=~/data-ui=/) ? $& : $1.$2." data-ui=\"messages-fixed\">"@e' "$F"

# 2) حقن useEffect لمنع السحب أثناء الكتابة قبل if (!open)
perl -0777 -i -pe '
  if (index($_,"addEventListener(\"touchmove\", prevent, {passive:false})")<0) {
    s@(}\,\s*\[\]\);\s*\n\s*if\s*\(!open\)\s*return\s*null;)@
      "}\, []);\n\n".
      "  useEffect(() => {\n".
      "    const prevent = (e:any)=>{ try{ const a=document.activeElement as any; if(a && (a.tagName===\"INPUT\"||a.tagName===\"TEXTAREA\")) e.preventDefault(); }catch{} };\n".
      "    const onF=()=>{ try{ window.addEventListener(\"touchmove\", prevent, {passive:false}); }catch{} };\n".
      "    const onB=()=>{ try{ window.removeEventListener(\"touchmove\", prevent); }catch{} };\n".
      "    document.addEventListener(\"focusin\", onF);\n".
      "    document.addEventListener(\"focusout\", onB);\n".
      "    return ()=>{ document.removeEventListener(\"focusin\", onF); document.removeEventListener(\"focusout\", onB); window.removeEventListener(\"touchmove\", prevent); };\n".
      "  }, []);\n\n$1"@es
  }
' "$F"

# قبول
HAS_DATA_UI=$([ -f "$F" ] && grep -q 'data-ui="messages-fixed"' "$F" && echo 1 || echo 0)
HAS_TOUCH_GUARD=$([ -f "$F" ] && grep -q 'addEventListener("touchmove", prevent, {passive:false})' "$F" && echo 1 || echo 0)
HAS_VV=$([ -f "$F" ] && grep -q 'visualViewport' "$F" && echo 1 || echo 0)

{
  echo "BACKUP_DIR=$BK"
  echo "PATCHED=$F"
  echo
  echo "-- Acceptance --"
  echo "MSG_DATA_UI=$HAS_DATA_UI"
  echo "MSG_TOUCH_GUARD=$HAS_TOUCH_GUARD"
  echo "MSG_VISUAL_VIEWPORT_PRESENT=$HAS_VV"
  echo "REPORT=$REP"
} | tee "$REP"
