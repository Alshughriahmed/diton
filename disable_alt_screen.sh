
#!/usr/bin/env bash
# disable_alt_screen.sh - منع alternate screen تماماً
set -euo pipefail

# تعطيل alternate screen capabilities
export TERM=dumb
export NO_COLOR=1
export CI=1
export LANG=C
export LC_ALL=C

# تعطيل TTY features للأدوات الشائعة  
export VERCEL_NO_TTY=1
export PNPM_NO_TTY=1
export NPM_CONFIG_NO_UPDATE_NOTIFIER=true
export NPM_CONFIG_NO_FUND_MESSAGE=true

# إنشاء wrapper function لتنظيف terminal
cleanup_terminal() {
    # إعادة تعيين terminal state
    stty sane 2>/dev/null || true
    # إجبار الخروج من alternate screen
    printf '\e[?1049l' 2>/dev/null || true
    # مسح الشاشة وإعادة cursor للأعلى
    printf '\e[2J\e[H' 2>/dev/null || true
    # إعادة تعيين كاملة
    printf '\ec' 2>/dev/null || true
}

# تثبيت cleanup عند الخروج
trap cleanup_terminal EXIT INT TERM

# wrapper function للأوامر الخطيرة
safe_exec() {
    local cmd="$1"
    shift
    
    # تعطيل alternate screen قبل التنفيذ
    cleanup_terminal
    
    # تشغيل الأمر مع pipe لمنع TTY detection
    echo "تشغيل: $cmd $*"
    if command -v "$cmd" >/dev/null 2>&1; then
        # استخدام script لمحاكاة non-TTY environment
        script -qec "$cmd $*" /dev/null 2>&1 | cat
    else
        echo "خطأ: الأمر $cmd غير موجود"
        return 1
    fi
    
    # تنظيف نهائي
    cleanup_terminal
}

# تصدير الدوال للاستخدام في سكريبتات أخرى
export -f cleanup_terminal
export -f safe_exec

echo "تم تعطيل alternate screen. استخدم safe_exec للأوامر التفاعلية."
