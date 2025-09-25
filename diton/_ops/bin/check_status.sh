. _ops/bin/disable_alt_screen.sh || true
#!/usr/bin/env bash
set -euo pipefail
mkdir -p _ops/state _ops/reports
echo "=== locks ==="
ls -1 _ops/state 2>/dev/null || true
echo "=== latest reports ==="
ls -1t _ops/reports | head -n 10 || true
