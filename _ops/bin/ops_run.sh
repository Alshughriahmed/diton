#!/usr/bin/env bash
set -Eeuo pipefail
echo "=== Running: $1 ==="
if [[ -x "$1" ]]; then
  "$@"
else
  echo "Script not executable or not found: $1"
  exit 1
fi
echo "=== Completed: $1 ==="
