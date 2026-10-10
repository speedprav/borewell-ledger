#!/usr/bin/env bash
# preflight.sh - Verify all required tools and config before deploy
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
BEDROCK_MODEL="${BEDROCK_MODEL_ID:-amazon.nova-micro-v1:0}"
ERRORS=0

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $label"
  else
    echo -e "  ${RED}✗${NC} $label"
    ERRORS=$((ERRORS+1))
  fi
}

echo "=== Borewell Ledger Preflight Check ==="
echo ""

echo "Tools:"
check "aws CLI" "aws --version"
check "sam CLI" "sam --version"
check "node >= 18" "node --version | grep -E 'v(1[89]|[2-9][0-9])'"
check "python3.12" "python3.12 --version || python3 --version | grep '3\\.1[2-9]'"
check "git" "git --version"

echo ""
echo "AWS Credentials:"
if aws sts get-caller-identity --output json 2>/dev/null | grep -q Account; then
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
  CALLER=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null)
  echo -e "  ${GREEN}✓${NC} Authenticated as: $CALLER"
  echo -e "  ${GREEN}✓${NC} Account: $ACCOUNT"
else
  echo -e "  ${RED}✗${NC} AWS credentials not configured"
  echo ""
  echo "  Please run: aws configure"
  echo "  Or set: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION"
  ERRORS=$((ERRORS+1))
fi

echo ""
echo "Region: $REGION"
aws configure set region "$REGION" 2>/dev/null || true

echo ""
echo "Bedrock Model Check (region: $REGION):"
# Try to check model availability
if aws bedrock list-foundation-models --region "$REGION" --output json 2>/dev/null | grep -q "nova-micro"; then
  echo -e "  ${GREEN}✓${NC} Amazon Nova Micro available in $REGION"
  BEDROCK_MODEL="amazon.nova-micro-v1:0"
elif aws bedrock list-foundation-models --region "us-east-1" --output json 2>/dev/null | grep -q "nova-micro"; then
  echo -e "  ${YELLOW}⚠${NC}  Nova Micro not in $REGION, using us-east-1"
  BEDROCK_MODEL="amazon.nova-micro-v1:0"
  export BEDROCK_REGION="us-east-1"
else
  echo -e "  ${YELLOW}⚠${NC}  Could not verify Bedrock model. Proceeding with default."
  echo -e "  ${YELLOW}!${NC}  If Bedrock fails, the app will use template fallbacks (still functional)."
fi
export BEDROCK_MODEL_ID="$BEDROCK_MODEL"
echo "  Model: $BEDROCK_MODEL"

echo ""
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}✗ Preflight failed with $ERRORS error(s). Fix above issues before deploying.${NC}"
  exit 1
else
  echo -e "${GREEN}✓ All preflight checks passed!${NC}"
fi
