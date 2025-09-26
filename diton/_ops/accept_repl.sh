#!/bin/bash
BASE_URL="$1"
if [ -z "$BASE_URL" ]; then
  echo "Usage: $0 <BASE_URL>"
  exit 1
fi

echo "Testing RTC acceptance for: $BASE_URL"

# Test RTC env
echo "Testing /api/rtc/env..."
RTC_ENV=$(curl -s "$BASE_URL/api/rtc/env")
echo "RTC_ENV response: $RTC_ENV"
RTC_MODE=$(echo "$RTC_ENV" | grep -o '"mode":"[^"]*"' | cut -d'"' -f4)
RTC_PING_OK=$(echo "$RTC_ENV" | grep -o '"ping_ok":[^,}]*' | cut -d':' -f2)

# Test TURN
echo "Testing /api/turn..."
TURN_RESPONSE=$(curl -s "$BASE_URL/api/turn")
echo "TURN response: $TURN_RESPONSE"
TURN_TLS443_PRESENT=0
TURN_CREDENTIAL_PRESENT=0
if echo "$TURN_RESPONSE" | grep -q "turn:.*:443"; then
  TURN_TLS443_PRESENT=1
fi
if echo "$TURN_RESPONSE" | grep -q '"credential"'; then
  TURN_CREDENTIAL_PRESENT=1
fi

# Initialize anonymous sessions
echo "Initializing anonymous sessions..."
COOKIES_A=$(mktemp)
COOKIES_B=$(mktemp)

curl -s -c "$COOKIES_A" "$BASE_URL/api/anon/init" > /dev/null
curl -s -c "$COOKIES_B" "$BASE_URL/api/anon/init" > /dev/null

# Test enqueue for both clients
echo "Testing enqueue..."
ENQUEUE_A=$(curl -s -w "%{http_code}" -o /dev/null -b "$COOKIES_A" -X POST "$BASE_URL/api/rtc/enqueue")
ENQUEUE_B=$(curl -s -w "%{http_code}" -o /dev/null -b "$COOKIES_B" -X POST "$BASE_URL/api/rtc/enqueue")

# Test matchmake
echo "Testing matchmake..."
MATCH_A=$(curl -s -b "$COOKIES_A" -X POST "$BASE_URL/api/rtc/matchmake")
MATCH_B=$(curl -s -b "$COOKIES_B" -X POST "$BASE_URL/api/rtc/matchmake")

echo "Match A: $MATCH_A"
echo "Match B: $MATCH_B"

PAIR_ID_MATCH=0
NO_403_ON_RTC=1

# Check if both got same pairId
PAIR_A=$(echo "$MATCH_A" | grep -o '"pairId":"[^"]*"' | cut -d'"' -f4)
PAIR_B=$(echo "$MATCH_B" | grep -o '"pairId":"[^"]*"' | cut -d'"' -f4)

if [ "$PAIR_A" = "$PAIR_B" ] && [ -n "$PAIR_A" ]; then
  PAIR_ID_MATCH=1
fi

# Check for any 403 errors
if [ "$ENQUEUE_A" = "403" ] || [ "$ENQUEUE_B" = "403" ]; then
  NO_403_ON_RTC=0
fi

# Cleanup
rm -f "$COOKIES_A" "$COOKIES_B"

# Print acceptance block
echo ""
echo "-- Acceptance --"
echo "RTC_MODE=$RTC_MODE"
echo "RTC_PING_OK=$RTC_PING_OK"
echo "TURN_TLS443_PRESENT=$TURN_TLS443_PRESENT"
echo "TURN_CREDENTIAL_PRESENT=$TURN_CREDENTIAL_PRESENT"
echo "PAIR_ID_MATCH=$PAIR_ID_MATCH"
echo "NO_403_ON_RTC=$NO_403_ON_RTC"
echo "-- End Acceptance --"