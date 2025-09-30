#!/usr/bin/env bash
set -euo pipefail
for B in https://www.ditonachat.com https://ditonachat.com; do
  echo "-- $B"
  J=$(mktemp)
  curl -s -c "$J" -b "$J" "$B/api/anon/init" | jq '.'
  curl -s -o /dev/null -w "enqueue:%{http_code}\n" -c "$J" -b "$J" -H 'content-type: application/json' -d '{}' "$B/api/rtc/enqueue"
done
