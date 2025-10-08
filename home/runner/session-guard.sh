
#!/usr/bin/env bash
# session-guard — non-interactive shell profile
export TERM=dumb
export CI=1 NO_COLOR=1 FORCE_COLOR=0
export PAGER=cat GIT_PAGER=cat GH_PAGER=cat MANPAGER=cat
export LESS='-RFX' EDITOR=true VISUAL=true GIT_EDITOR=true
git config --global core.pager cat >/dev/null 2>&1 || true

# فلتر ANSI لإزالة smcup/rmcup ومسح الشاشة
_ANSI_FILTER="sed -u -e \$'s/\\x1b\\[\\?1049[hl]//g' -e \$'s/\\x1b\\[2J//g' -e \$'s/\\x1b\\[H//g'"

# دالة تشغيل آمن
safe() { stdbuf -oL -eL bash -lc "$*" 2>&1 | eval "$_ANSI_FILTER"; }

# استعادة الشاشة إن تم تفعيلها خارجيًا
printf '\e[?1049l' || true
