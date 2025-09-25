
#!/usr/bin/env bash

# === حماية من مشاكل Alternate Screen ===

# تعيين نوع طرفية آمن
export TERM=dumb
export CI=1
export NO_COLOR=1
export FORCE_COLOR=0

# تعطيل pager التفاعلي
export PAGER=cat
export MANPAGER=cat
export GIT_PAGER=cat
export LESS=FRX

# تعطيل TTY detection للأدوات الشائعة
export VERCEL_CLI_FORCE_NON_TTY=1
export PNPM_NO_TTY=1
export NPM_CONFIG_NO_UPDATE_NOTIFIER=true
export NPM_CONFIG_NO_FUND_MESSAGE=true

# دالة تنظيف الطرفية
cleanup_terminal() {
    stty sane 2>/dev/null || true
    printf '\e[?1049l\e[2J\e[H\ec' 2>/dev/null || true
}

# تطبيق التنظيف عند الخروج
trap cleanup_terminal EXIT INT TERM

# دالة تنفيذ آمن للأوامر
safe_run() {
    echo "تنفيذ: $*"
    cleanup_terminal
    
    # تنفيذ الأمر مع إعادة توجيه stdin لمنع التفاعل
    bash -c "$*" </dev/null 2>&1 | cat
    
    cleanup_terminal
}

echo "✅ تم تفعيل حماية الطرفية"
echo "استخدم safe_run 'command' لتنفيذ الأوامر بأمان"
