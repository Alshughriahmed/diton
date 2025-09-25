#!/usr/bin/env bash
set -euo pipefail
cd "${ROOT:-/home/runner/workspace}"
OUT="_ops/reports/batch_C_probe_$(date -u +%Y%m%d-%H%M%S).log"; mkdir -p _ops/reports

p(){ echo; echo "=== $1 ===" | tee -a "$OUT"; }
s(){ [ -f "$1" ] && echo "$1" || echo "MISSING:$1"; }

# 1) matchmake route
F1="src/app/api/rtc/matchmake/route.ts"
p "matchmake: $(s "$F1")"
[ -f "$F1" ] && { grep -nE 'export const (dynamic|runtime)|peerAnonId|found|country|gender' "$F1" | tee -a "$OUT" || true; nl -ba "$F1" | sed -n '1,220p' | tee -a "$OUT"; }

# 2) mm.ts (Prev/TTLs/locks/last)
F2="src/lib/rtc/mm.ts"
p "mm.ts: $(s "$F2")"
[ -f "$F2" ] && {
  p "prev-wish / prev-for order";    grep -nE "prev-wish|prev-for" "$F2" | tee -a "$OUT" || true
  p "SETNX / PX locks";              grep -nE "SETNX|setNx|NX.*PX|PX.*NX|pairLock|claim" "$F2" | tee -a "$OUT" || true
  p "rtc:last writes";               grep -nE "rtc:last" "$F2" | tee -a "$OUT" || true
  p "TTL numbers";                   grep -nE "[^0-9](7000|8500|6000|150000|120000|300000)[^0-9]" "$F2" | tee -a "$OUT" || true
  nl -ba "$F2" | sed -n '1,260p' | tee -a "$OUT"
}

# 3) ChatMessagingBar + ChatClient (وسوم ورسائل/لايك)
F3="src/app/chat/components/ChatMessagingBar.tsx"
p "ChatMessagingBar: $(s "$F3")"
[ -f "$F3" ] && { grep -nE 'fixed|inset-x-0|bottom-0|z-\[70\]|messages-fixed|visualViewport|Portal' "$F3" | tee -a "$OUT" || true; nl -ba "$F3" | sed -n '1,200p' | tee -a "$OUT"; }

F4="src/app/chat/ChatClient.tsx"
p "ChatClient: $(s "$F4")"
[ -f "$F4" ] && {
  p "btn prev/next data-ui";         grep -nE 'data-ui="btn-(prev|next)"' "$F4" | tee -a "$OUT" || true
  p "peer-meta handlers";            grep -nE 'ditona:peer-meta|meta:init|peerMeta' "$F4" | tee -a "$OUT" || true
  p "like sync";                     grep -nE 'like|DataChannel|toggle' "$F4" | tee -a "$OUT" || true
  nl -ba "$F4" | sed -n '1,240p' | tee -a "$OUT"
}

echo "-- Acceptance --" | tee -a "$OUT"
echo "PROBE_OK=1" | tee -a "$OUT"
echo "REPORT=$OUT" | tee -a "$OUT"
