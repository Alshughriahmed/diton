
#!/usr/bin/env bash
# debug_terminal.sh - تشخيص مشاكل alternate screen
set -euo pipefail

LOG_FILE="_ops/logs/terminal_debug.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "=== تشخيص Terminal ===" | tee "$LOG_FILE"
echo "الوقت: $(date)" | tee -a "$LOG_FILE"

# فحص البيئة الحالية
echo "" | tee -a "$LOG_FILE"
echo "متغيرات البيئة:" | tee -a "$LOG_FILE"
echo "TERM=$TERM" | tee -a "$LOG_FILE"
echo "COLORTERM=${COLORTERM:-not_set}" | tee -a "$LOG_FILE"
echo "CI=${CI:-not_set}" | tee -a "$LOG_FILE"

# فحص TTY capabilities
echo "" | tee -a "$LOG_FILE"
echo "TTY info:" | tee -a "$LOG_FILE"
if tty >/dev/null 2>&1; then
    echo "TTY detected: $(tty)" | tee -a "$LOG_FILE"
    stty -a 2>&1 | head -n 3 | tee -a "$LOG_FILE"
else
    echo "No TTY detected" | tee -a "$LOG_FILE"
fi

# فحص terminal capabilities
echo "" | tee -a "$LOG_FILE"
echo "Terminal capabilities:" | tee -a "$LOG_FILE"
if command -v tput >/dev/null 2>&1; then
    echo "tput cols: $(tput cols 2>/dev/null || echo 'unknown')" | tee -a "$LOG_FILE"
    echo "tput lines: $(tput lines 2>/dev/null || echo 'unknown')" | tee -a "$LOG_FILE"
    echo "smcup capability: $(tput smcup 2>/dev/null | od -c || echo 'none')" | tee -a "$LOG_FILE"
else
    echo "tput not available" | tee -a "$LOG_FILE"
fi

# مراقب alternate screen sequences
monitor_alt_screen() {
    local cmd="$1"
    shift
    
    echo "" | tee -a "$LOG_FILE"
    echo "مراقبة $cmd للـ alternate screen sequences..." | tee -a "$LOG_FILE"
    
    # تشغيل الأمر وتسجيل الـ output
    script -q -c "$cmd $*" /tmp/terminal_output.txt 2>&1 &
    local pid=$!
    
    # مراقبة الـ sequences لمدة 10 ثوان
    timeout 10s sh -c "
        while kill -0 $pid 2>/dev/null; do
            if [ -f /tmp/terminal_output.txt ]; then
                if grep -a '1049' /tmp/terminal_output.txt >/dev/null 2>&1; then
                    echo 'تم اكتشاف alternate screen sequence!' | tee -a '$LOG_FILE'
                    grep -ao '\\\\e\\[[?0-9;]*[hl]' /tmp/terminal_output.txt | tee -a '$LOG_FILE' || true
                    break
                fi
            fi
            sleep 0.5
        done
    " || true
    
    # تنظيف
    kill $pid 2>/dev/null || true
    wait $pid 2>/dev/null || true
    rm -f /tmp/terminal_output.txt
}

# تصدير الدالة للاستخدام الخارجي
export -f monitor_alt_screen

echo "" | tee -a "$LOG_FILE"
echo "تم حفظ التشخيص في: $LOG_FILE"
echo "لاستخدام المراقب: source debug_terminal.sh && monitor_alt_screen <command>"
