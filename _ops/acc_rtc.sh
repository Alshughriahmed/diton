#!/bin/bash
set -euo pipefail

BASE="${1:-http://localhost:5000}"
echo "Testing RTC endpoints at: $BASE"

# Test basic connectivity
echo "1. Testing ping..."
PING_RESULT=$(curl -s "$BASE/api/rtc/ping")
echo "Ping: $PING_RESULT"

# Test queue length
echo "2. Testing queue length..."
QLEN_RESULT=$(curl -s "$BASE/api/rtc/qlen")
echo "Queue length: $QLEN_RESULT"

# Generate test anon IDs
A="test-anon-a-$(date +%s)"
B="test-anon-b-$(date +%s)"

echo "3. Testing enqueue..."
# Enqueue A
A_ENQUEUE=$(curl -s -X POST -H "content-type: application/json" \
  -d "{\"anonId\":\"$A\"}" "$BASE/api/rtc/enqueue")
echo "A enqueue: $A_ENQUEUE"

# Enqueue B  
B_ENQUEUE=$(curl -s -X POST -H "content-type: application/json" \
  -d "{\"anonId\":\"$B\"}" "$BASE/api/rtc/enqueue")
echo "B enqueue: $B_ENQUEUE"

echo "4. Testing matchmake..."
# Try to matchmake A
A_MATCH=$(curl -s -X POST -H "x-anon-id: $A" "$BASE/api/rtc/matchmake")
echo "A matchmake: $A_MATCH"

# Extract pairId if successful
if echo "$A_MATCH" | grep -q '"pairId"'; then
  PAIR=$(echo "$A_MATCH" | sed -n 's/.*"pairId":"\([^"]*\)".*/\1/p')
  echo "Found pair: $PAIR"
  
  echo "5. Testing SDP exchange..."
  # A posts offer
  OFFER_POST=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "x-anon-id: $A" -H "content-type: application/json" \
    -X POST -d "{\"pairId\":\"$PAIR\",\"sdp\":\"v=0-dummy-offer\"}" "$BASE/api/rtc/offer")
  echo "Offer POST status: $OFFER_POST"
  
  # B posts answer  
  ANSWER_POST=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "x-anon-id: $B" -H "content-type: application/json" \
    -X POST -d "{\"pairId\":\"$PAIR\",\"sdp\":\"v=0-dummy-answer\"}" "$BASE/api/rtc/answer")
  echo "Answer POST status: $ANSWER_POST"
  
  echo "6. Testing ICE exchange..."
  # Test ICE candidate exchange
  ICE_POST=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "content-type: application/json" \
    -X POST -d "{\"pairId\":\"$PAIR\",\"anonId\":\"$A\",\"candidate\":{\"candidate\":\"test\"}}" "$BASE/api/rtc/ice")
  echo "ICE POST status: $ICE_POST"
  
  ICE_GET=$(curl -s "$BASE/api/rtc/ice?pairId=$PAIR&anonId=$B")
  echo "ICE GET result: $ICE_GET"
  
else
  echo "Matchmake failed - no pair created"
fi

echo "7. Final queue length..."
FINAL_QLEN=$(curl -s "$BASE/api/rtc/qlen")  
echo "Final queue length: $FINAL_QLEN"

echo "Test complete!"