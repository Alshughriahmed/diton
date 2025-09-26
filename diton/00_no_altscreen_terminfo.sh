
#!/usr/bin/env bash
set -euo pipefail
ROOT="${ROOT:-/home/runner/workspace}"; cd "$ROOT"
mkdir -p _ops/terminfo _ops/backups _ops/reports _ops/bin

BASE_TERM="${TERM:-xterm-256color}"
SRC="_ops/terminfo/${BASE_TERM}.src"
NEW="${BASE_TERM}-noalt"

# اصنع terminfo بلا smcup/rmcup
infocmp -1 "$BASE_TERM" > "$SRC"
cp -a "$SRC" "_ops/backups/${BASE_TERM}.src.$(date -u +%Y%m%d-%H%M%S)"
awk '!/^[ \t]*(smcup|rmcup)=/' "$SRC" | \
  awk 'NR==1{ sub(/^'"$BASE_TERM"'\|?/, "'"$NEW"'|"); } {print}' \
  > "_ops/terminfo/${NEW}.src"
tic -x -o "_ops/terminfo" "_ops/terminfo/${NEW}.src"

# حدّث الحارس ليستخدم terminfo الجديد دائمًا
GUARD="_ops/bin/shell_guard.sh"
[ -f "$GUARD" ] || { echo '#!/usr/bin/env bash' > "$GUARD"; chmod +x "$GUARD"; }
cp -a "$GUARD" "_ops/backups/shell_guard.sh.$(date -u +%Y%m%d-%H%M%S)"
grep -q 'DITONA_NOALT_GUARD' "$GUARD" 2>/dev/null || cat >> "$GUARD" <<'EOF'
# DITONA_NOALT_GUARD
ROOT="${ROOT:-/home/runner/workspace}"
export TERMINFO="$ROOT/_ops/terminfo"
if infocmp "${TERM:-xterm-256color}-noalt" >/dev/null 2>&1; then
  export TERM="${TERM:-xterm-256color}-noalt"
fi
export CI=1 NO_COLOR=1 FORCE_COLOR=0 PAGER=cat MANPAGER=cat GIT_PAGER=cat LESS=FRX
printf '\e[?1049l' 2>/dev/null || true; tput rmcup 2>/dev/null || true
trap 'stty sane 2>/dev/null || true; printf "\e[?1049l\ec" 2>/dev/null || true; tput rmcup 2>/dev/null || true' EXIT
EOF

# مُشغّل افتراضي إن لم يوجد
[ -x _ops/bin/run ] || cat > _ops/bin/run <<'EOR'
#!/usr/bin/env bash
set -euo pipefail
ROOT="${ROOT:-/home/runner/workspace}"; cd "$ROOT"
source _ops/bin/shell_guard.sh || true
[[ $# -ge 1 ]] || { echo "usage: _ops/bin/run <script> [args...]"; exit 2; }
( while true; do echo "[HB] $(date -u +%H:%M:%S)"; sleep 10; done ) & HB=$!
trap 'kill $HB 2>/dev/null || true' EXIT
TS=$(date -u +%Y%m%d-%H%M%S); LOG="_ops/reports/$(basename "$1").${TS}.log"
bash -lc "set -euo pipefail; source _ops/bin/shell_guard.sh || true; bash \"$1\" ${*:2}" </dev/null 2>&1 | stdbuf -oL -eL tee "$LOG"
EOR
chmod +x _ops/bin/run

echo "-- Acceptance --"
echo "NO_ALT_TERM_INSTALLED=1"
echo "TERMINFO_DIR=_ops/terminfo"
echo "NEW_TERM=${NEW}"
