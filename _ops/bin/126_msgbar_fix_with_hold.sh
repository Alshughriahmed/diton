. _ops/bin/disable_alt_screen.sh || true
set -euo pipefail
. _ops/bin/_hold.sh
hold_begin; pulse_start

TS=$(date -u +%Y%m%d-%H%M%S)
BK="_ops/backups/msgbar_fix_${TS}"; REP="_ops/reports/msgbar_fix_${TS}.log"
mkdir -p "$BK" _ops/reports
F=src/app/chat/components/ChatMessagingBar.tsx
test -f "$F"; install -D "$F" "$BK/$F"

# 1) data-ui="messages-fixed" على العنصر الخارجي
if ! grep -q 'data-ui="messages-fixed"' "$F"; then
  perl -0777 -i -pe 's@(<div\s+ref=\{ref\}\s+className="[^"]*")>@$1 data-ui="messages-fixed">@' "$F"
fi

# 2) منع Next/Prev أثناء الكتابة قبل if (!open) return null;
if ! grep -q 'preventNavIfTyping' "$F"; then
  perl -0777 -i -pe '
    s/(\n\s*if\s*\(!open\)\s*return\s*null;)/\n  useEffect(() => {\n    const preventNavIfTyping = (e:any) => {\n      try {\n        const a=document.activeElement as any; const t=e.target as HTMLElement | null;\n        const typing = a && (a.tagName==="INPUT"||a.tagName==="TEXTAREA");\n        if (!typing || !t) return;\n        const hit = t.closest?.('\''[data-ui="btn-next"]'\'', '\''[data-ui="btn-prev"]'\'');\n        if (hit) { e.preventDefault(); e.stopPropagation(); }\n      } catch {}\n    };\n    document.addEventListener("click", preventNavIfTyping, true);\n    return ()=> document.removeEventListener("click", preventNavIfTyping, true);\n  }, []);\n\n$1/s
  ' "$F"
fi

HAS_DATA_UI=$([ -f "$F" ] && grep -q 'data-ui="messages-fixed"' "$F" && echo 1 || echo 0)
NAV_GUARD=$([ -f "$F" ] && grep -q 'preventNavIfTyping' "$F" && echo 1 || echo 0)

pulse_stop
{
  echo "BACKUP_DIR=$BK"
  echo "PATCHED=$F"
  echo
  echo "-- Acceptance --"
  echo "MSG_DATA_UI=$HAS_DATA_UI"
  echo "NAV_BLOCK_ON_TYPING=$NAV_GUARD"
  echo "REPORT=$REP"
} | tee "$REP"
