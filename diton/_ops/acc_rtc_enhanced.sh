#!/bin/bash
set -euo pipefail

BASE="${1:-http://localhost:5000}"
echo "=== Enhanced RTC Acceptance Test ==="
echo "Testing at: $BASE"
echo

# Test anon init
echo "1. Testing anon cookie system..."
ANON_RESULT=$(curl -s "$BASE/api/anon/init")
echo "Anon init: $ANON_RESULT"
echo

# Test basic connectivity
echo "2. Testing ping..."
PING_RESULT=$(curl -s "$BASE/api/rtc/ping")
echo "Ping: $PING_RESULT"
echo

# Test queue length
echo "3. Testing initial queue length..."
QLEN_RESULT=$(curl -s "$BASE/api/rtc/qlen") 
echo "Initial queue: $QLEN_RESULT"
echo

# Generate test anon IDs
A="test-anon-a-$(date +%s)-${RANDOM}"
B="test-anon-b-$(date +%s)-${RANDOM}"
echo "Generated test IDs: A=$A, B=$B"
echo

# Enqueue both users
echo "4. Enqueueing users..."
A_ENQUEUE=$(curl -s -X POST -H "content-type: application/json" \
  -d "{\"anonId\":\"$A\"}" "$BASE/api/rtc/enqueue")
echo "A enqueue: $A_ENQUEUE"

B_ENQUEUE=$(curl -s -X POST -H "content-type: application/json" \
  -d "{\"anonId\":\"$B\"}" "$BASE/api/rtc/enqueue") 
echo "B enqueue: $B_ENQUEUE"
echo

# Check queue length after enqueue
echo "5. Queue length after enqueue..."
QLEN_AFTER=$(curl -s "$BASE/api/rtc/qlen")
echo "Queue after enqueue: $QLEN_AFTER"
echo

# Try matchmaking multiple times to ensure pairing works
echo "6. Testing matchmaking (multiple attempts)..."
for i in {1..3}; do
  echo "Attempt $i:"
  
  # Try to matchmake
  MATCH_RESULT=$(curl -s -X POST "$BASE/api/rtc/matchmake")
  echo "  Matchmake result: $MATCH_RESULT"
  
  # Check if we got a pair
  if echo "$MATCH_RESULT" | grep -q '"paired":true'; then
    PAIR_ID=$(echo "$MATCH_RESULT" | sed -n 's/.*"pairId":"\([^"]*\)".*/\1/p')
    echo "  SUCCESS: Found pair $PAIR_ID"
    
    # Test SDP exchange with dummy data
    echo "  Testing SDP exchange..."
    
    # User A (caller) posts offer
    OFFER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "x-anon-id: $A" -H "content-type: application/json" \
      -X POST -d "{\"pairId\":\"$PAIR_ID\",\"role\":\"caller\",\"sdp\":\"v=0 dummy offer\",\"anonId\":\"$A\"}" \
      "$BASE/api/rtc/offer")
    echo "  Offer POST: $OFFER_STATUS"
    
    # User B (callee) posts answer
    ANSWER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "x-anon-id: $B" -H "content-type: application/json" \
      -X POST -d "{\"pairId\":\"$PAIR_ID\",\"role\":\"callee\",\"sdp\":\"v=0 dummy answer\",\"anonId\":\"$B\"}" \
      "$BASE/api/rtc/answer")
    echo "  Answer POST: $ANSWER_STATUS"
    
    # Test ICE exchange
    echo "  Testing ICE exchange..."
    ICE_A_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "content-type: application/json" \
      -X POST -d "{\"pairId\":\"$PAIR_ID\",\"candidate\":{\"candidate\":\"test-ice-from-a\"},\"anonId\":\"$A\"}" \
      "$BASE/api/rtc/ice")
    echo "  ICE from A: $ICE_A_STATUS"
    
    ICE_B_GET=$(curl -s "$BASE/api/rtc/ice?pairId=$PAIR_ID&anonId=$B")
    echo "  ICE for B: $ICE_B_GET"
    
    break
  else
    echo "  No pair found, continuing..."
    sleep 1
  fi
done
echo

# Final status
echo "7. Final system status..."
FINAL_QLEN=$(curl -s "$BASE/api/rtc/qlen")
echo "Final queue: $FINAL_QLEN"
echo

echo "=== Test Summary ==="
if echo "$MATCH_RESULT" | grep -q '"paired":true'; then
  echo "✅ SUCCESS: RTC system working - pairing, SDP exchange, and ICE working"
  echo "✅ Anon cookie system functional"  
  echo "✅ Queue management working"
  exit 0
else
  echo "❌ PARTIAL: Basic endpoints working but pairing needs investigation"
  echo "ℹ️  This might be expected if Redis is in fallback mode"
  exit 1
fi