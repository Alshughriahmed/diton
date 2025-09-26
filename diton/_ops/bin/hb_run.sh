#!/usr/bin/env bash
set -euo pipefail
# بيئة غير تفاعلية + منع الشاشة البديلة
export TERM=dumb CI=1 NO_COLOR=1 FORCE_COLOR=0 PAGER=cat MANPAGER=cat GIT_PAGER=cat LESS=FRX
printf '\e[?1049l' 2>/dev/null || true; tput rmcup 2>/dev/null || true
# نبضات مستمرة كل 5 ثوانٍ
( while true; do echo "[HB] $(date -u +%H:%M:%S)"; sleep 5; done ) & HB=$!
cleanup(){ kill $HB 2>/dev/null || true; stty sane 2>/dev/null || true; printf '\e[?1049l\ec' 2>/dev/null || true; tput rmcup 2>/dev/null || true; }
trap cleanup EXIT
# تشغيل السكربت المطلوب وتسجيل الخرج
TS=$(date -u +%Y%m%d-%H%M%S)
LOG="_ops/reports/$(basename "$1").${TS}.log"
bash -lc "set -euo pipefail; bash \"$@\"" </dev/null 2>&1 | stdbuf -oL -eL tee "$LOG"
echo; echo "اضغط Enter لإيقاف النبضات والخروج"
read -r _
