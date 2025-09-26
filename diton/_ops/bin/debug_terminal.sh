. _ops/bin/disable_alt_screen.sh || true
#!/usr/bin/env bash
set -Eeuo pipefail
out="$(_ops/bin/disable_alt_screen.sh bash -lc 'printf "\e[?1049hTEST\e[?1049l" 2>/dev/null || true' | od -An -tx1 | tr -s " ")"
echo "$out"
echo "-- Acceptance --"
echo "ALT_SEQ_PRESENT=$([[ "$out" =~ 1b\ \?\ 10\ 49\ 68 ]] && echo 1 || echo 0)"
