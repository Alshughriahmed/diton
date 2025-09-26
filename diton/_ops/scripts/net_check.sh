#!/usr/bin/env bash
set -euo pipefail
D="www.ditonachat.com"
echo "DNS $D:"; getent hosts "$D" || nslookup "$D" || true
echo "TLS $D:"; printf "Q" | openssl s_client -connect "$D:443" -servername "$D" -tls1_2 2>/dev/null | awk '/Protocol|Cipher|Verify return code/'
echo "TLS global.turn.twilio.com:"; printf "Q" | openssl s_client -connect global.turn.twilio.com:443 -servername global.turn.twilio.com -tls1_2 2>/dev/null | awk '/Protocol|Cipher|Verify return code/'
