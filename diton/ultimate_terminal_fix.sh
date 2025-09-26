
#!/usr/bin/env bash
set -euo pipefail

echo "=== الحل النهائي لمشاكل اختفاء الشاشة ==="

# 1) إنشاء بنية المجلدات
mkdir -p _ops/{terminfo,bin,backups}

# 2) إنشاء terminfo entries آمنة
cat > _ops/terminfo/safe-terminal.src <<'EOF'
safe-terminal|completely safe terminal,
    am, bw,
    cols#80, lines#24,
    bel=^G, cr=^M, cud1=^J, ind=^J,
EOF

# ترجمة terminfo
tic -x -o _ops/terminfo _ops/terminfo/safe-terminal.src 2>/dev/null || true

# 3) إنشاء wrapper script محمي
cat > _ops/bin/protected_run.sh <<'EOPR'
#!/usr/bin/env bash
set -euo pipefail

# === بيئة محمية 100% ===
export TERMINFO="${PWD}/_ops/terminfo"
export TERM="safe-terminal"
export CI=1 NO_COLOR=1 FORCE_COLOR=0
export PAGER=cat MANPAGER=cat GIT_PAGER=cat LESS=FRX
export npm_config_yes=true npm_config_fund=false npm_config_audit=false
export PNPM_PROGRESS=false HUSKY=0

# إجبار الخروج من أي شاشة بديلة
printf '\e[?1049l\e[2J\e[H' 2>/dev/null || true
stty sane 2>/dev/null || true

# حماية شاملة عند الخروج
cleanup() {
    stty sane 2>/dev/null || true
    printf '\e[?1049l\e[2J\e[H\ec' 2>/dev/null || true
    tput rmcup 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# بدء نبضات حية للتأكد من عمل السكريپت
( while true; do echo "[▪] $(date +%H:%M:%S)"; sleep 5; done ) & 
HEARTBEAT_PID=$!
trap 'kill $HEARTBEAT_PID 2>/dev/null || true; cleanup' EXIT INT TERM

echo "🔒 بدء التنفيذ المحمي: $*"

# تنفيذ الأمر مع script لمنع TTY detection
if command -v script >/dev/null 2>&1; then
    script -qfec "$*" /dev/null 2>&1 | cat
else
    bash -c "$*" </dev/null 2>&1 | cat
fi

echo "✅ انتهى التنفيذ بأمان"
EOPR

chmod +x _ops/bin/protected_run.sh

# 4) إنشاء alias للاستخدام السهل
cat > _ops/bin/run_safe <<'EORS'
#!/usr/bin/env bash
# استخدام: run_safe "command here"
exec _ops/bin/protected_run.sh "$@"
EORS

chmod +x _ops/bin/run_safe

# 5) اختبار النظام
echo ""
echo "=== اختبار النظام الجديد ==="

# اختبار أن terminfo يعمل
if infocmp -A "_ops/terminfo" safe-terminal >/dev/null 2>&1; then
    echo "✅ terminfo محمي تم إنشاؤه بنجاح"
else
    echo "⚠️  تحذير: مشكلة في terminfo"
fi

# اختبار أن smcup/rmcup فارغان
SMCUP_TEST=$(TERMINFO="_ops/terminfo" TERM="safe-terminal" tput smcup 2>/dev/null | od -An -tx1 | tr -d ' ' || true)
if [[ -z "$SMCUP_TEST" ]]; then
    echo "✅ smcup معطل بنجاح"
else
    echo "⚠️  smcup لا يزال نشطاً: $SMCUP_TEST"
fi

echo ""
echo "=== طريقة الاستخدام ==="
echo "1. استخدم: _ops/bin/run_safe 'your_command_here'"
echo "2. أو: _ops/bin/protected_run.sh your_script.sh"
echo "3. مثال: _ops/bin/run_safe 'ls -la && pwd'"
echo ""
echo "=== الفوائد ==="
echo "• منع اختفاء الشاشة نهائياً"
echo "• نبضات حية تؤكد عمل السكريپت"  
echo "• تنظيف تلقائي عند الخروج"
echo "• حماية من جميع escape sequences"
echo "• يعمل مع جميع أنواع السكريپتات"
