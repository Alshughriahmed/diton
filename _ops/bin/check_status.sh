
#!/usr/bin/env bash
set -euo pipefail

echo "=== Active Locks ==="
ls -la _ops/locks/ 2>/dev/null || echo "No locks directory"

echo -e "\n=== Recent Logs ==="
ls -lt _ops/logs/*.log 2>/dev/null | head -5 || echo "No recent logs"

echo -e "\n=== Running Processes ==="
ps aux | grep -E "(bash|pnpm|node)" | grep -v grep || echo "No relevant processes"

echo -e "\n=== Last Build Status ==="
if [ -f ".next/BUILD_ID" ]; then
  echo "Build exists: $(cat .next/BUILD_ID)"
else
  echo "No build found"
fi
