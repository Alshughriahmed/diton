
# دليل حل مشكلة اختفاء الشاشة في Terminal

## الأسباب الرئيسية لاختفاء الشاشة

### 1. استخدام Alternate Screen Buffer
- **السبب**: بعض البرامج تستخدم خاصية `smcup` و `rmcup` للتبديل إلى شاشة بديلة
- **كيف يحدث**: عندما يُستدعى `tput smcup` أو escape sequence `\e[?1049h`
- **الأدوات المسببة**: vim, nano, less, more, htop, screen, tmux

### 2. TTY Detection والتفاعل
- **السبب**: البرامج تكتشف أنها تعمل في terminal تفاعلي فتفعل alternate screen
- **أمثلة**: npm, pnpm, vercel cli, git pager

### 3. Escape Sequences غير المتحكم بها
- **السبب**: برامج ترسل escape sequences مباشرة للتحكم في Terminal
- **نتيجة**: تغيير حالة Terminal بشكل غير متوقع

### 4. Script وأدوات Recording
- **السبب**: استخدام `script` command يمكن أن يسبب تفعيل alternate screen
- **متى يحدث**: عند استخدام script لتسجيل الأوامر

## الحلول المطبقة في المشروع

### 1. إنشاء Terminfo محمي
```bash
# إنشاء نوع terminal بدون alternate screen
cat > xterm-noalt.src <<'EOF'
xterm-noalt|xterm without alternate screen,
    rmcup@, smcup@,
    use=xterm-256color,
EOF
tic -x -o _ops/terminfo xterm-noalt.src
```

### 2. متغيرات البيئة الآمنة
```bash
export TERM=dumb                    # نوع terminal آمن
export CI=1                         # إخبار الأدوات أنها في CI
export NO_COLOR=1                   # تعطيل الألوان
export FORCE_COLOR=0                # منع الألوان الإجبارية
export PAGER=cat                    # استخدام cat بدلاً من less
export MANPAGER=cat                 # منع man من استخدام alternate screen
export GIT_PAGER=cat               # منع git من استخدام alternate screen
export LESS=FRX                    # إعدادات less آمنة
```

### 3. تعطيل TTY Detection
```bash
export VERCEL_CLI_FORCE_NON_TTY=1   # منع vercel من اكتشاف TTY
export PNPM_NO_TTY=1               # منع pnpm من التفاعل
export NPM_CONFIG_NO_UPDATE_NOTIFIER=true
export NPM_CONFIG_NO_FUND_MESSAGE=true
export HUSKY=0                     # تعطيل husky hooks
```

### 4. دوال التنظيف
```bash
cleanup_terminal() {
    stty sane 2>/dev/null || true                    # إعادة تعيين terminal
    printf '\e[?1049l' 2>/dev/null || true           # الخروج من alternate screen
    printf '\e[2J\e[H' 2>/dev/null || true           # مسح الشاشة
    printf '\ec' 2>/dev/null || true                 # إعادة تعيين كاملة
    tput rmcup 2>/dev/null || true                   # الخروج من alternate screen
}
```

## الممارسات الأفضل لتجنب المشكلة

### 1. قبل تشغيل أي سكريبت
```bash
# تعيين بيئة آمنة
source _ops/bin/shell_guard.sh

# أو استخدام wrapper محمي
_ops/bin/protected_run.sh your_script.sh
```

### 2. في السكريبتات
```bash
#!/usr/bin/env bash
set -euo pipefail

# إعداد بيئة آمنة في بداية كل سكريپت
export TERM=dumb CI=1 NO_COLOR=1
trap cleanup_terminal EXIT INT TERM
```

### 3. للأوامر الخطيرة
```bash
# استخدام script مع إعادة توجيه للمنع TTY detection
script -qfec "your_command" /dev/null 2>&1 | cat

# أو استخدام bash مع stdin مغلق
bash -c "your_command" </dev/null 2>&1 | cat
```

## أدوات الحماية المتوفرة في المشروع

### 1. Shell Guard (_ops/bin/shell_guard.sh)
- تعيين terminfo محمي
- متغيرات بيئة آمنة
- دالة تنظيف تلقائية

### 2. Protected Runner (_ops/bin/protected_run.sh)
- wrapper شامل للسكريپتات
- نبضات حية لمراقبة التقدم
- تنظيف تلقائي عند الخروج

### 3. Ultimate Guard (_ops/bin/ultimate_guard.sh)
- حماية قصوى من alternate screen
- استخدام script لمنع TTY detection
- معالجة جميع حالات الخروج

## مؤشرات المشكلة

### علامات اختفاء الشاشة:
1. الشاشة تصبح فارغة أثناء تنفيذ السكريپت
2. النص يختفي ولا يظهر مخرجات
3. Terminal يتوقف عن الاستجابة
4. المؤشر (cursor) يختفي

### كيفية التحقق:
```bash
# اختبار وجود alternate screen sequences
script -qec "your_command" /tmp/test.txt
grep -a "1049" /tmp/test.txt
```

## استكشاف الأخطاء

### 1. إذا اختفت الشاشة:
```bash
# محاولة استعادة الشاشة
printf '\e[?1049l\e[2J\e[H\ec'
stty sane
```

### 2. للتحقق من حالة Terminal:
```bash
# عرض إعدادات stty الحالية
stty -a

# التحقق من نوع TERM
echo $TERM

# اختبار alternate screen
tput smcup 2>/dev/null && echo "DANGER: smcup works" || echo "SAFE: smcup disabled"
```

## الخلاصة

مشكلة اختفاء الشاشة سببها الرئيسي استخدام alternate screen buffer. الحل يتطلب:

1. **منع**: استخدام terminfo محمي وبيئة آمنة
2. **كشف**: مراقبة escape sequences ومخرجات البرامج  
3. **تنظيف**: دوال تنظيف تلقائية عند الخروج
4. **استعادة**: أوامر لاستعادة حالة Terminal الطبيعية

باستخدام الأدوات المتوفرة في `_ops/bin/` يمكن تجنب هذه المشكلة نهائياً.
