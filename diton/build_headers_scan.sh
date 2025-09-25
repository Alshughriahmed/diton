#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"
echo "## versions"
node -v 2>/dev/null || true
jq -r '.dependencies.next,.devDependencies.next' package.json 2>/dev/null | head -n1 || true
echo "## headers /chat (after age)"
curl -s -X POST -c /tmp/age.ok "$BASE/api/age/allow" >/dev/null
curl -sI -b /tmp/age.ok "$BASE/chat" | awk 'BEGIN{IGNORECASE=1}/^(Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy):/{print}'
echo "## robots/sitemap"
curl -sI "$BASE/sitemap.xml" | head -n1
curl -s "$BASE/robots.txt" | head -n5
