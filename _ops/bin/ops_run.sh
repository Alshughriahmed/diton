#!/usr/bin/env bash
set -Eeuo pipefail
echo "=== Running: $1 ==="
[ -x "$1" ] || { echo "Script not executable or not found: $1"; exit 1; }
"$@"
echo "=== Completed: $1 ==="
