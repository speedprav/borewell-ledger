#!/usr/bin/env bash
# smoke_test.sh - Verify every endpoint returns expected shape
set -euo pipefail

API_URL="${API_URL:-}"
if [ -z "$API_URL" ]; then
  echo "ERROR: API_URL environment variable is required"
  echo "  export API_URL=https://xxx.execute-api.ap-south-1.amazonaws.com/prod"
  exit 1
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="$4"
  local expect="$5"

  if [ "$method" = "GET" ]; then
    resp=$(curl -sf -X GET "$API_URL$path" -H "Content-Type: application/json" 2>/dev/null || echo '{"error":"curl failed"}')
  else
    resp=$(curl -sf -X "$method" "$API_URL$path" \
      -H "Content-Type: application/json" \
      -d "$body" 2>/dev/null || echo '{"error":"curl failed"}')
  fi

  if echo "$resp" | grep -q "$expect"; then
    echo -e "  ${GREEN}✓${NC} $name"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}✗${NC} $name"
    echo "    Expected: $expect"
    echo "    Got: ${resp:0:200}"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Borewell Ledger Smoke Tests ==="
echo "API: $API_URL"
echo ""

# Health
check "GET /health" GET "/health" "" "healthy"

# Map
check "GET /map" GET "/map" "" "wells"

# Alerts
check "GET /alerts" GET "/alerts" "" "alerts"
check "GET /alerts?status=new" GET "/alerts?status=new" "" "alerts"
check "GET /alerts?severity=CRITICAL" GET "/alerts?severity=CRITICAL" "" "alerts"

# Community
check "GET /community" GET "/community" "" "hotspots"

# Create a well
WELL_RESP=$(curl -sf -X POST "$API_URL/wells" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smoke Test Well",
    "ownerType": "other",
    "locality": "TestLocality",
    "lat": 22.31,
    "lon": 73.18,
    "depthM": 25.0,
    "date": "'$(date +%Y-%m-%d)'"
  }' 2>/dev/null || echo '{"error":"failed"}')

WELL_ID=$(echo "$WELL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('well',{}).get('wellId',''))" 2>/dev/null || echo "")

if [ -n "$WELL_ID" ]; then
  echo -e "  ${GREEN}✓${NC} POST /wells (created: $WELL_ID)"
  PASS=$((PASS+1))

  # Get well
  check "GET /wells/{id}" GET "/wells/$WELL_ID" "" "readings"

  # Add reading (different date)
  YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d 2>/dev/null || echo "$(date +%Y-%m-%d)")
  check "POST /readings" POST "/readings" \
    "{\"wellId\":\"$WELL_ID\",\"depthM\":25.5,\"date\":\"$YESTERDAY\"}" \
    "reading"
else
  echo -e "  ${RED}✗${NC} POST /wells (failed: ${WELL_RESP:0:100})"
  FAIL=$((FAIL+1))
fi

# AI endpoints (may be template or AI)
check "POST /ai/analyze" POST "/ai/analyze" \
  '{"wellId":"seed-well-001","language":"en"}' \
  "summary"

check "POST /ai/plan" POST "/ai/plan" \
  '{"wellId":"seed-well-001","role":"society","language":"en"}' \
  "measures"

check "POST /ai/chat" POST "/ai/chat" \
  '{"messages":[{"role":"user","content":"How is this borewell doing?"}],"wellId":"seed-well-001","language":"en"}' \
  "reply"

# Admin run-analysis (cooldown check is OK too)
ANALYSIS_RESP=$(curl -sf -X POST "$API_URL/admin/run-analysis" \
  -H "Content-Type: application/json" 2>/dev/null || echo '{"error":"failed"}')

if echo "$ANALYSIS_RESP" | grep -qE '"status":(.*"completed"|.*"cooldown")'; then
  echo -e "  ${GREEN}✓${NC} POST /admin/run-analysis"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}✗${NC} POST /admin/run-analysis"
  echo "    Got: ${ANALYSIS_RESP:0:200}"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== Results ==="
echo -e "  ${GREEN}Passed: $PASS${NC}"
if [ $FAIL -gt 0 ]; then
  echo -e "  ${RED}Failed: $FAIL${NC}"
  exit 1
else
  echo -e "  ${GREEN}All tests passed!${NC}"
fi
