#!/usr/bin/env bash
set -euo pipefail

is_tty(){ [[ -t 0 && -t 1 ]]; }

pulse_start(){
  is_tty || return 0
  if [[ -n "${PULSE_PID:-}" ]] && kill -0 "$PULSE_PID" 2>/dev/null; then return 0; fi
  ( while :; do printf "\r⏳ running… %s" "$(date '+%H:%M:%S')"; sleep 1; done ) & export PULSE_PID=$!
}

pulse_stop(){
  if [[ -n "${PULSE_PID:-}" ]]; then kill "$PULSE_PID" 2>/dev/null || true; unset PULSE_PID; printf "\r"; fi
}

hold_here(){
  pulse_stop
  is_tty || return 0
  echo
  read -r -p "${1:-اضغط Enter للمتابعة}" _
}

hold_on_exit(){
  trap '__rc=$?; pulse_stop; echo; echo "[HOLD] exit code $__rc"; is_tty && read -r -p "اضغط Enter للخروج" _; exit $__rc' EXIT
}

print_accept(){
  # يطبع آخر كتلة قبول من ملف لوق
  log="${1:-}"
  [[ -f "$log" ]] || return 0
  awk '
    /^-- Acceptance --/ {seen=NR}
    {lines[NR]=$0}
    END{
      if(!seen){exit 0}
      for(i=seen;i<=NR && i<seen+200;i++) print lines[i]
    }' "$log" || true
}
