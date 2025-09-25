#!/usr/bin/env bash
set -u
BASE="https://www.ditonachat.com"   # غيّره عند الحاجة إلى دومين فيرصل المؤقت

bold(){ printf "\e[1m%s\e[0m\n" "$*"; }
row(){ printf "%-35s %s\n" "$1" "$2"; }
hc(){ curl -sS -o /dev/null -w "%{http_code}" "$1"; }
get(){ curl -sS "$1"; }
hdr(){ curl -sSI "$1" | tr -d '\r'; }

bold "== DitonaChat Production Acceptance =="
row "Domain" "$BASE"

bold $'\n-- Auth --'
P1=$(hc "$BASE/api/auth/providers")
S1=$(hc "$BASE/api/auth/session")
L1=$(hc "$BASE/login")
row "/api/auth/providers" "HTTP $P1 (expect 200)"
row "/api/auth/session"   "HTTP $S1 (expect 200)"
row "/login"              "HTTP $L1 (expect 200/302)"

bold $'\n-- Stripe / Plans (EUR) --'
PLANS_JSON="$(get "$BASE/api/stripe/prices")"
PLANS_COUNT=$(node -e 'let s=require("fs").readFileSync(0,"utf8");try{let j=JSON.parse(s);let a=j.data||j;console.log(Array.isArray(a)?a.length:0)}catch(e){console.log(0)}' <<<"$PLANS_JSON")
CURRENCY=$(node -e 'let s=require("fs").readFileSync(0,"utf8");try{let j=JSON.parse(s);let a=j.data||j;console.log((a?.[0]?.currency||"").toLowerCase())}catch(e){console.log("")}' <<<"$PLANS_JSON")
row "/api/stripe/prices count" "$PLANS_COUNT (expect 4)"
row "currency"                 "$CURRENCY (expect eur)"

bold $'\n-- Pages & Headers --'
H_HEALTH=$(hc "$BASE/api/health")
H_PRIV=$(hc "$BASE/privacy")
H_TERMS=$(hc "$BASE/terms")
H_FAV=$(hc "$BASE/favicon.ico")
PP=$(hdr "$BASE/chat" | awk -F': ' 'tolower($1)=="permissions-policy"{print $2}')
CSP=$(hdr "$BASE/chat" | awk -F': ' 'tolower($1)=="content-security-policy"{print $2}')
row "/api/health" "HTTP $H_HEALTH (expect 200)"
row "/privacy"   "HTTP $H_PRIV (expect 200)"
row "/terms"     "HTTP $H_TERMS (expect 200)"
row "/favicon.ico" "HTTP $H_FAV (expect 200)"
row "Permissions-Policy header" "${PP:+present} ${PP:-missing}"
row "CSP header"                "${CSP:+present} ${CSP:-missing}"

bold $'\n-- Filters & Geo --'
H_GEO=$(hc "$BASE/api/geo")
row "/api/geo" "HTTP $H_GEO (expect 200)"
H_COUNTRY=$(hc "$BASE/api/filters/country")
H_GENDER=$(hc "$BASE/api/filters/gender")
row "/api/filters/country" "HTTP $H_COUNTRY (optional)"
row "/api/filters/gender"  "HTTP $H_GENDER (optional)"

bold $'\n-- Match burst (rate-limit) --'
CODES=""
for i in 1 2 3 4 5; do CODES+=$(hc "$BASE/api/match/next"),; done
row "Burst 5 codes" "${CODES%?}  (expect 200,200,200,429,429)"

bold $'\n-- Messaging (guest limit smoke) --'
# محاكاة خفيفة: تأكد من وجود المسار فقط (الحدّ يُختبر داخل التطبيق)
MSG=$(hc "$BASE/api/message")
row "/api/message" "HTTP $MSG (expect 200)"

bold $'\n== Summary Expectations =='
echo "Auth OK (providers & session 200), Login 200/302"
echo "4 Stripe plans, currency=eur"
echo "Privacy/Terms/Health/Favicon 200"
echo "Permissions-Policy & CSP headers present on /chat"
echo "Burst limits match pattern 200,200,200,429,429"
echo "Geo endpoint 200; filters reachable; message API reachable"
