#!/usr/bin/env bash
set -euo pipefail
NAME="${1:?name}"; shift
bash _ops/bin/safe_runner.sh "$NAME" "$@"
