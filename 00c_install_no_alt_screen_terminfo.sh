
#!/usr/bin/env bash
set -euo pipefail
ROOT="${ROOT:-/home/runner/workspace}"; cd "$ROOT"
mkdir -p _ops/terminfo _ops/backups _ops/reports
[ -f _ops/bin/shell_guard.sh ] || { echo "MISSING:_ops/bin/shell_guard.sh"; exit 2; }

# 1) توليد تعريف terminfo يلغي smcup/rmcup ويَرِث xterm-256color
cat > _ops/terminfo/xterm-noaltscr.src <<'EOF'
xterm-noaltscr|xterm without alternate screen,
  rmcup@, smcup@,
  use=xterm-256color,
EOF

# 2) ترجمة التعريف إلى قاعدة بيانات terminfo خاصة بنا
tic -x -o _ops/terminfo _ops/terminfo/xterm-noaltscr.src

# 3) حقن الإعدادات في shell_guard ليستخدم نوع الطرفية الجديد لكل السكربتات
cp -a _ops/bin/shell_guard.sh _ops/backups/shell_guard.$(date -u +%Y%m%d-%H%M%S).bak
grep -q 'xterm-noaltscr' _ops/bin/shell_guard.sh || cat >> _ops/bin/shell_guard.sh <<'EOSG'

# enforce non-alternate-screen terminfo
export TERMINFO="${ROOT:-/home/runner/workspace}/_ops/terminfo"
export TERM="xterm-noaltscr"
EOSG
chmod +x _ops/bin/shell_guard.sh

# 4) تحقّق أن smcup/rmcup ملغيتان في النوع الجديد
infocmp -A "_ops/terminfo" xterm-noaltscr | grep -q 'rmcup@' && R1=1 || R1=0
infocmp -A "_ops/terminfo" xterm-noaltscr | grep -q 'smcup@' && R2=1 || R2=0

echo "-- Acceptance --"
echo "NO_ALT_SCREEN_TERMINFO=$((R1 & R2))"
echo "TERM_TO_USE=xterm-noaltscr"
echo "TERMINFO_DIR=$(pwd)/_ops/terminfo"
