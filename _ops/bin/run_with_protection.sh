
#!/usr/bin/env bash
set -euo pipefail

# Usage: bash _ops/bin/run_with_protection.sh script_name "command to run"
SCRIPT_NAME="$1"
shift

# استخدام safe_runner
exec bash _ops/bin/safe_runner.sh "$SCRIPT_NAME" "$@"
