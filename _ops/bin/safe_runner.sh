
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="${1:-unknown}"
LOCK_DIR="_ops/locks"
LOCK_FILE="$LOCK_DIR/${SCRIPT_NAME}.lock"
LOG_FILE="_ops/logs/${SCRIPT_NAME}_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOCK_DIR" "_ops/logs"

# Check if already running
if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Script $SCRIPT_NAME already running (PID: $PID)"
    exit 1
  else
    echo "Removing stale lock file"
    rm -f "$LOCK_FILE"
  fi
fi

# Create lock
echo $$ > "$LOCK_FILE"
trap "rm -f '$LOCK_FILE'" EXIT

# Run with logging
echo "Starting $SCRIPT_NAME at $(date)" | tee "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

# Heartbeat في الخلفية
(while kill -0 $$ 2>/dev/null; do 
  echo "[$(date +%H:%M:%S)] Heartbeat: $SCRIPT_NAME running..." 
  sleep 30
done) &
HEARTBEAT_PID=$!
trap "kill $HEARTBEAT_PID 2>/dev/null || true; rm -f '$LOCK_FILE'" EXIT

# Execute actual script
shift
exec "$@"
