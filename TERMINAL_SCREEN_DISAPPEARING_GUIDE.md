
# دليل شامل لحل مشكلة اختفاء الشاشة في Terminal

## 📋 فهرس المحتويات
1. [ما هي المشكلة؟](#ما-هي-المشكلة)
2. [الأسباب الجذرية](#الأسباب-الجذرية)
3. [الحلول التقنية](#الحلول-التقنية)
4. [طرق الوقاية](#طرق-الوقاية)
5. [أدوات الحماية](#أدوات-الحماية)
6. [أمثلة عملية](#أمثلة-عملية)
7. [نصائح متقدمة](#نصائح-متقدمة)

---

## ما هي المشكلة؟

مشكلة **"اختفاء الشاشة"** في Terminal تحدث عندما تُنفذ السكريپتات أو الأوامر ويختفي المحتوى السابق، تاركاً شاشة فارغة أو مختلفة. هذا يسبب:

- فقدان المخرجات المهمة
- عدم القدرة على رؤية تقدم العمل
- صعوبة في تتبع الأخطاء
- تجربة مستخدم سيئة

---

## الأسباب الجذرية

### 1. **Alternate Screen Mode**
- **السبب**: استخدام escape sequences مثل `\e[?1049h` و `\e[?1049l`
- **مصدر المشكلة**: بعض التطبيقات تنتقل لشاشة بديلة مؤقتة
- **التأثير**: إخفاء المحتوى الأصلي للطرفية

### 2. **Terminal Capabilities (terminfo)**
- **السبب**: قدرات `smcup` و `rmcup` في تعريف الطرفية
- **مصدر المشكلة**: terminfo database يحتوي على كودات التحكم
- **التأثير**: التطبيقات تستدعي هذه القدرات تلقائياً

### 3. **التطبيقات التفاعلية**
- **السبب**: برامج مثل `less`, `vi`, `nano`, `htop`, `man`
- **مصدر المشكلة**: تغيير وضع الطرفية للعمل التفاعلي  
- **التأثير**: الانتقال للشاشة البديلة واستعادتها عند الخروج

### 4. **إعدادات البيئة**
- **السبب**: متغيرات مثل `TERM`, `PAGER`, `LESS`
- **مصدر المشكلة**: إعدادات غير مناسبة للبيئة التلقائية
- **التأثير**: تفعيل الميزات التفاعلية غير المرغوبة

### 5. **أدوات التطوير الحديثة**
- **السبب**: أدوات مثل `vercel`, `pnpm`, `npm` تكتشف TTY
- **مصدر المشكلة**: محاولة تحسين العرض للمستخدم التفاعلي
- **التأثير**: استخدام ميزات تفاعلية في بيئة غير تفاعلية

---

## الحلول التقنية

### 1. **إنشاء terminfo مخصص بدون alternate screen**

```bash
# إنشاء تعريف terminfo آمن
cat > _ops/terminfo/xterm-noalt.src <<'EOF'
xterm-noalt|xterm without alternate screen,
    rmcup@, smcup@,
    use=xterm-256color,
EOF

# ترجمة التعريف
tic -x -o _ops/terminfo _ops/terminfo/xterm-noalt.src

# استخدام التعريف الجديد
export TERMINFO="${PWD}/_ops/terminfo"
export TERM="xterm-noalt"
```

### 2. **تعطيل قدرات الشاشة البديلة**

```bash
# إجبار الخروج من الشاشة البديلة
printf '\e[?1049l' 2>/dev/null || true

# تعطيل tput capabilities
tput rmcup 2>/dev/null || true

# إعادة تعيين الطرفية
stty sane 2>/dev/null || true
```

### 3. **ضبط متغيرات البيئة الواقية**

```bash
# تعيين بيئة آمنة
export TERM=dumb
export CI=1
export NO_COLOR=1
export FORCE_COLOR=0

# تعطيل pager التفاعلي
export PAGER=cat
export MANPAGER=cat
export GIT_PAGER=cat
export LESS=FRX

# تعطيل TTY detection
export VERCEL_CLI_FORCE_NON_TTY=1
export PNPM_NO_TTY=1
export NPM_CONFIG_NO_UPDATE_NOTIFIER=true
```

---

## طرق الوقاية

### 1. **استخدام wrapper scripts**

```bash
#!/usr/bin/env bash
# wrapper آمن لتنفيذ الأوامر

# إعداد البيئة الآمنة
setup_safe_environment() {
    export TERMINFO="${PWD}/_ops/terminfo"
    export TERM="dumb-safe"
    export CI=1 NO_COLOR=1 FORCE_COLOR=0
    printf '\e[?1049l' 2>/dev/null || true
    stty sane 2>/dev/null || true
}

# تنظيف عند الخروج
cleanup_on_exit() {
    stty sane 2>/dev/null || true
    printf '\e[?1049l\e[2J\e[H\ec' 2>/dev/null || true
}

# تطبيق الحماية
setup_safe_environment
trap cleanup_on_exit EXIT INT TERM

# تنفيذ الأمر المطلوب
exec "$@"
```

### 2. **فحص وتشخيص المشكلة**

```bash
# فحص قدرات الطرفية الحالية
check_terminal_capabilities() {
    echo "TERM=$TERM"
    echo "smcup capability: $(tput smcup 2>/dev/null | od -c || echo 'none')"
    echo "rmcup capability: $(tput rmcup 2>/dev/null | od -c || echo 'none')"
    
    # فحص terminfo
    if infocmp "$TERM" 2>/dev/null | grep -E '^(smcup|rmcup)=' >/dev/null; then
        echo "⚠️  الطرفية تحتوي على alternate screen capabilities"
    else
        echo "✅ الطرفية آمنة من alternate screen"
    fi
}
```

### 3. **مراقبة الـ escape sequences**

```bash
# مراقبة alternate screen sequences في الوقت الفعلي
monitor_escape_sequences() {
    local cmd="$1"
    shift
    
    echo "مراقبة $cmd للـ alternate screen sequences..."
    
    # تسجيل الـ output مع تحليل الـ sequences
    script -q -c "$cmd $*" /tmp/output.txt 2>&1 &
    local pid=$!
    
    # فحص دوري للـ sequences
    while kill -0 $pid 2>/dev/null; do
        if grep -a '1049' /tmp/output.txt >/dev/null 2>&1; then
            echo "🚨 تم اكتشاف alternate screen sequence!"
            break
        fi
        sleep 0.5
    done
    
    wait $pid
    rm -f /tmp/output.txt
}
```

---

## أدوات الحماية

### 1. **سكريپت الحماية الشامل**

```bash
#!/usr/bin/env bash
# ultimate_protection.sh - حماية شاملة من مشاكل الشاشة البديلة

set -euo pipefail

# === إعداد البيئة المحمية ===
setup_ultimate_protection() {
    # إنشاء terminfo آمن
    mkdir -p _ops/terminfo
    cat > _ops/terminfo/safe-terminal.src <<'EOF'
safe-terminal|completely safe terminal,
    am, bw,
    cols#80, lines#24,
    bel=^G, cr=^M, cud1=^J, ind=^J,
EOF
    tic -x -o _ops/terminfo _ops/terminfo/safe-terminal.src 2>/dev/null || true
    
    # ضبط متغيرات البيئة
    export TERMINFO="${PWD}/_ops/terminfo"
    export TERM="safe-terminal"
    export CI=1 NO_COLOR=1 FORCE_COLOR=0
    export PAGER=cat MANPAGER=cat GIT_PAGER=cat LESS=FRX
    
    # تعطيل أدوات TTY
    export VERCEL_CLI_FORCE_NON_TTY=1
    export PNPM_NO_TTY=1
    export NPM_CONFIG_NO_UPDATE_NOTIFIER=true
    export HUSKY=0
    
    # إجبار الخروج من الشاشة البديلة
    printf '\e[?1049l\e[2J\e[H' 2>/dev/null || true
    stty sane 2>/dev/null || true
}

# === تنظيف شامل ===
ultimate_cleanup() {
    stty sane 2>/dev/null || true
    printf '\e[?1049l\e[2J\e[H\ec' 2>/dev/null || true
    tput rmcup 2>/dev/null || true
}

# === نبضات حية ===
start_heartbeat() {
    ( while true; do 
        echo "[▪] $(date +%H:%M:%S) - العملية تعمل..." 
        sleep 5
      done ) & 
    export HEARTBEAT_PID=$!
}

stop_heartbeat() {
    [[ -n "${HEARTBEAT_PID:-}" ]] && kill "$HEARTBEAT_PID" 2>/dev/null || true
}

# === التطبيق ===
setup_ultimate_protection
trap 'stop_heartbeat; ultimate_cleanup' EXIT INT TERM
start_heartbeat

echo "🔒 بدء التنفيذ المحمي: $*"

# تنفيذ الأمر مع حماية إضافية
if command -v script >/dev/null 2>&1; then
    script -qfec "$*" /dev/null 2>&1 | cat
else
    bash -c "$*" </dev/null 2>&1 | cat
fi

echo "✅ انتهى التنفيذ بأمان"
```

### 2. **أداة التشخيص المتقدم**

```bash
#!/usr/bin/env bash
# advanced_diagnosis.sh - تشخيص متقدم لمشاكل الطرفية

diagnose_terminal_issues() {
    local log_file="_ops/logs/terminal_diagnosis.log"
    mkdir -p "$(dirname "$log_file")"
    
    {
        echo "=== تشخيص شامل للطرفية ==="
        echo "التاريخ: $(date)"
        echo "البيئة: $(uname -a)"
        echo ""
        
        echo "متغيرات البيئة:"
        echo "TERM=${TERM:-unset}"
        echo "COLORTERM=${COLORTERM:-unset}"
        echo "CI=${CI:-unset}"
        echo "TTY=$(tty 2>/dev/null || echo 'not detected')"
        echo ""
        
        echo "قدرات الطرفية:"
        if command -v tput >/dev/null 2>&1; then
            echo "tput cols: $(tput cols 2>/dev/null || echo 'unknown')"
            echo "tput lines: $(tput lines 2>/dev/null || echo 'unknown')"
            
            local smcup_hex rmcup_hex
            smcup_hex=$(tput smcup 2>/dev/null | od -An -tx1 | tr -d ' ' || echo 'empty')
            rmcup_hex=$(tput rmcup 2>/dev/null | od -An -tx1 | tr -d ' ' || echo 'empty')
            
            echo "smcup (hex): $smcup_hex"
            echo "rmcup (hex): $rmcup_hex"
            
            if [[ "$smcup_hex" == "empty" && "$rmcup_hex" == "empty" ]]; then
                echo "✅ الطرفية آمنة - لا توجد alternate screen capabilities"
            else
                echo "⚠️  الطرفية تحتوي على alternate screen capabilities"
            fi
        else
            echo "tput غير متوفر"
        fi
        echo ""
        
        echo "فحص terminfo:"
        if command -v infocmp >/dev/null 2>&1; then
            if infocmp "$TERM" 2>/dev/null | grep -E '^[[:space:]]*(smcup|rmcup)=' >/dev/null; then
                echo "⚠️  terminfo يحتوي على alternate screen definitions"
                infocmp "$TERM" 2>/dev/null | grep -E '^[[:space:]]*(smcup|rmcup)='
            else
                echo "✅ terminfo آمن من alternate screen"
            fi
        else
            echo "infocmp غير متوفر"
        fi
        echo ""
        
        echo "الأدوات المثبتة:"
        for tool in script less vi nano man htop; do
            if command -v "$tool" >/dev/null 2>&1; then
                echo "✓ $tool متوفر"
            else
                echo "✗ $tool غير متوفر"
            fi
        done
        
    } | tee "$log_file"
    
    echo "تم حفظ التشخيص في: $log_file"
}

# تنفيذ التشخيص
diagnose_terminal_issues
```

---

## أمثلة عملية

### 1. **تنفيذ آمن لـ npm/pnpm**

```bash
#!/usr/bin/env bash
# safe_npm.sh - تنفيذ آمن لأوامر npm/pnpm

# إعداد البيئة الآمنة
export TERM=dumb CI=1 NO_COLOR=1 FORCE_COLOR=0
export npm_config_yes=true npm_config_fund=false npm_config_audit=false
export PNPM_PROGRESS=false PNPM_NO_TTY=1
printf '\e[?1049l' 2>/dev/null || true

# تنفيذ الأمر
echo "تنفيذ آمن: $*"
"$@" 2>&1 | cat
echo "✅ تم الانتهاء"
```

### 2. **تنفيذ آمن للـ git operations**

```bash
#!/usr/bin/env bash  
# safe_git.sh - تنفيذ آمن لأوامر git

# تعطيل pager
export GIT_PAGER=cat PAGER=cat
export TERM=dumb CI=1 NO_COLOR=1

# تنظيف الشاشة
printf '\e[?1049l' 2>/dev/null || true

# تنفيذ git
echo "Git operation: $*"
git "$@" 2>&1 | cat
```

### 3. **مراقبة السكريپتات طويلة المدى**

```bash
#!/usr/bin/env bash
# long_running_monitor.sh - مراقبة السكريپتات طويلة المدى

monitor_long_script() {
    local script_name="$1"
    shift
    
    # بدء نبضات المراقبة
    ( while true; do 
        echo "[$(date +%H:%M:%S)] $script_name قيد التشغيل..."
        sleep 10
      done ) &
    local monitor_pid=$!
    
    # تنظيف عند الخروج
    trap "kill $monitor_pid 2>/dev/null || true" EXIT INT TERM
    
    # تنفيذ السكريپت مع الحماية
    _ops/bin/ultimate_guard.sh "$@"
    
    # إيقاف المراقبة
    kill $monitor_pid 2>/dev/null || true
    echo "✅ انتهى تنفيذ $script_name"
}

# مثال على الاستخدام
monitor_long_script "build_process" npm run build
```

---

## نصائح متقدمة

### 1. **كشف المشاكل المبكر**

```bash
# إضافة للـ .bashrc أو .shell_init
detect_alt_screen_usage() {
    if [[ "$-" == *i* ]]; then  # تفاعلي فقط
        return 0
    fi
    
    # كشف استخدام alternate screen
    if [[ "${TERM:-}" == *"xterm"* ]] && command -v tput >/dev/null 2>&1; then
        local smcup_out
        smcup_out=$(tput smcup 2>/dev/null | od -An -tx1 | tr -d ' ' || true)
        if [[ -n "$smcup_out" ]]; then
            echo "⚠️  تحذير: الطرفية تستخدم alternate screen - قم بتطبيق الحماية"
        fi
    fi
}

# تشغيل الكشف عند كل shell جديد
detect_alt_screen_usage
```

### 2. **حماية تلقائية في .shell_init**

```bash
# إضافة للـ .shell_init لحماية تلقائية
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then  # sourced وليس executed
    # تطبيق حماية أساسية
    export TERM=dumb CI=1 NO_COLOR=1 FORCE_COLOR=0
    export PAGER=cat GIT_PAGER=cat LESS=FRX
    printf '\e[?1049l' 2>/dev/null || true
    
    # وظيفة مساعدة سريعة
    safe_run() {
        printf '\e[?1049l' 2>/dev/null || true
        "$@" 2>&1 | cat
        printf '\e[?1049l' 2>/dev/null || true
    }
    
    export -f safe_run
fi
```

### 3. **اختبار الحماية**

```bash
#!/usr/bin/env bash
# test_protection.sh - اختبار فعالية الحماية

test_alternate_screen_protection() {
    echo "=== اختبار حماية الشاشة البديلة ==="
    
    # اختبار 1: تحقق من terminfo
    local term_safe=0
    if ! infocmp "${TERM:-xterm}" 2>/dev/null | grep -E '^[[:space:]]*(smcup|rmcup)=' >/dev/null; then
        term_safe=1
    fi
    
    # اختبار 2: تحقق من tput output
    local tput_safe=0
    local smcup_empty rmcup_empty
    smcup_empty=$(tput smcup 2>/dev/null | od -An -tx1 | tr -d ' ' || true)
    rmcup_empty=$(tput rmcup 2>/dev/null | od -An -tx1 | tr -d ' ' || true)
    if [[ -z "$smcup_empty" && -z "$rmcup_empty" ]]; then
        tput_safe=1
    fi
    
    # اختبار 3: محاكاة استخدام less
    local less_test=0
    if echo "test content" | TERM="${TERM:-dumb}" less -F >/dev/null 2>&1; then
        less_test=1
    fi
    
    # النتائج
    echo "فحص terminfo: $([[ $term_safe == 1 ]] && echo '✅ آمن' || echo '❌ غير آمن')"
    echo "فحص tput: $([[ $tput_safe == 1 ]] && echo '✅ آمن' || echo '❌ غير آمن')"
    echo "فحص less: $([[ $less_test == 1 ]] && echo '✅ آمن' || echo '❌ غير آمن')"
    
    local total_score=$((term_safe + tput_safe + less_test))
    echo "النتيجة الإجمالية: $total_score/3"
    
    if [[ $total_score == 3 ]]; then
        echo "🎉 الحماية فعالة 100%"
        return 0
    else
        echo "⚠️  الحماية تحتاج تحسين"
        return 1
    fi
}

# تنفيذ الاختبار
test_alternate_screen_protection
```

---

## خلاصة الحماية

### ✅ **ما يجب فعله:**

1. **استخدم terminfo آمن** بدون `smcup`/`rmcup`
2. **اضبط متغيرات البيئة** المناسبة (`TERM=dumb`, `CI=1`)
3. **استخدم wrapper scripts** للأوامر الخطيرة
4. **أضف cleanup functions** لجميع السكريپتات
5. **راقب الـ escape sequences** في السكريپتات المهمة
6. **اختبر الحماية** بانتظام

### ❌ **ما يجب تجنبه:**

1. **تجنب الأوامر التفاعلية** في السكريپتات التلقائية
2. **لا تستخدم `less`** بدون تعطيل alternate screen
3. **تجنب `vi`/`nano`** في البيئة التلقائية
4. **لا تعتمد على pager** الافتراضي
5. **تجنب تشغيل أدوات TTY** بدون حماية

---

## 🚀 للبدء السريع:

1. نفذ السكريپت الشامل: `./ultimate_terminal_fix.sh`
2. استخدم `_ops/bin/run_safe 'your_command'` للأوامر الآمنة
3. أضف `source terminal_protection.sh` للسكريپتات الحساسة
4. اختبر بـ `./debug_terminal.sh` للتأكد من الحماية

**النتيجة**: شاشة مستقرة، مخرجات واضحة، وتجربة مستخدم ممتازة! 🎯
