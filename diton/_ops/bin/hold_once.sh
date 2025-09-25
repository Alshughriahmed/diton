. _ops/bin/disable_alt_screen.sh || true
set -Eeuo pipefail
PORT="${PORT:-3000}"; BASE="http://127.0.0.1:$PORT"
LOCK="_ops/.hold_lock"; mkdir -p _ops/logs
if mkdir "$LOCK" 2>/dev/null; then trap 'rm -rf "$LOCK"' EXIT; else echo "LOCK_HELD=1"; exit 2; fi
pkill -f ".next|node .*next|standalone" || true
if [ "$#" -gt 0 ]; then "$@" || { echo "PAYLOAD_FAILED=1"; exit 3; }; fi
nohup pnpm dev -p "$PORT" -H 0.0.0.0 >"_ops/logs/dev_hold.log" 2>&1 & disown
for i in $(seq 1 30); do code="$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health" || echo 000)"; [ "$code" = 200 ] && { OK=1; break; }; sleep 1; done
echo "-- Acceptance --"; echo "LOCK=1"; echo "HTTP_OK=${OK:-0}"
