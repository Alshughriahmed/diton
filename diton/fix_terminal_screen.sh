
#!/usr/bin/env bash
set -euo pipefail

echo "=== إصلاح مشكلة اختفاء الشاشة في Terminal ==="

# 1) إنشاء مجلد terminfo مخصص
mkdir -p _ops/terminfo

# 2) إنشاء تعريف terminfo بدون alternate screen capabilities
cat > _ops/terminfo/xterm-noalt.src <<'EOF'
xterm-noalt|xterm without alternate screen,
    rmcup@, smcup@,
    use=xterm-256color,
EOF

# 3) ترجمة التعريف إلى قاعدة بيانات
tic -x -o _ops/terminfo _ops/terminfo/xterm-noalt.src

# 4) إنشاء سكريپت حماية للشيل
cat > _ops/bin/safe_shell.sh <<'EOG'
#!/usr/bin/env bash
set -euo pipefail

# تعيين بيئة آمنة للطرفية
export TERMINFO="${PWD}/_ops/terminfo"
export TERM="xterm-noalt"
export CI=1 NO_COLOR=1 FORCE_COLOR=0
export PAGER=cat MANPAGER=cat GIT_PAGER=cat LESS=FRX

# منع الانتقال للشاشة البديلة
printf '\e[?1049l' 2>/dev/null || true
stty sane 2>/dev/null || true

# تنظيف عند الخروج
trap 'stty sane 2>/dev/null || true; printf "\e[?1049l\e[2J\e[H\ec" 2>/dev/null || true' EXIT INT TERM

# تنفيذ الأمر المطلوب
exec "$@"
EOG
chmod +x _ops/bin/safe_shell.sh

echo "✅ تم إنشاء بيئة آمنة للطرفية"
echo "استخدم: _ops/bin/safe_shell.sh <command> لتنفيذ الأوامر بأمان"
