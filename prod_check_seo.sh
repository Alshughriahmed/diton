#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://www.ditonachat.com}"

echo "# GET /"
HTML_HOME="$(curl -sS "$BASE/")"
TITLE="$(printf '%s' "$HTML_HOME" | grep -oP '(?i)(?<=<title>).*?(?=</title>)' | head -n1 || true)"
DESC="$(printf '%s' "$HTML_HOME" | grep -oP '(?i)<meta\s+name=["'\'']description["'\'']\s+content=["'\''][^"'\''>]+' | head -n1 || true)"
CANON="$(printf '%s' "$HTML_HOME" | grep -oP '(?i)<link\s+rel=["'\'']canonical["'\'']\s+href=["'\''][^"'\''>]+' | head -n1 || true)"
KWDS="$(printf '%s' "$HTML_HOME" | grep -oiE 'adult video chat|random cam chat|flingster alternative|18\+' | sort -u | tr '\n' ',' || true)"

echo "TITLE: $TITLE"
echo "META description: $DESC"
echo "CANONICAL: $CANON"
echo "SEO keywords found: $KWDS"

echo "# HEAD /sitemap.xml and /robots.txt"
curl -sS -o /dev/null -w "sitemap.xml=%{http_code}\n" "$BASE/sitemap.xml"
echo -n "robots.txt="; curl -sS -o - "$BASE/robots.txt" | head -n 5
