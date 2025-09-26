. _ops/bin/disable_alt_screen.sh || true
#!/usr/bin/env bash
set -euo pipefail
NAME="${1:?name}"; shift
bash _ops/bin/safe_runner.sh "$NAME" "$@"
