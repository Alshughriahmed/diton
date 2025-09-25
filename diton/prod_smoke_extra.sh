#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"
echo "## HEADERS /chat بعد العمر"
curl -s -X POST -c /tmp/age.ok "$BASE/api/age/allow" >/dev/null
curl -sI -b /tmp/age.ok "$BASE/chat" | awk 'BEGIN{IGNORECASE=1}/^(HTTP|Permissions-Policy|Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|Referrer-Policy):/{print}'
echo "## robots/sitemap"
curl -sI "$BASE/sitemap.xml" | head -n1
curl -s "$BASE/robots.txt" | head -n5
echo "## rate-limit burst (5 طلبات)"
codes=(); for i in 1 2 3 4 5; do codes+=("$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/match/next?gender=all&countries=US")"); done
printf "CODES: %s\n" "${codes[*]}"
