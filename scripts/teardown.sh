#!/usr/bin/env bash
# teardown.sh - Completely remove all Borewell Ledger resources
# Usage: ./scripts/teardown.sh [--stack-name borewell-ledger] [--region ap-south-1]
set -euo pipefail

STACK_NAME="${STACK_NAME:-borewell-ledger}"
REGION="${AWS_DEFAULT_REGION:-ap-south-1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo " Borewell Ledger — Teardown"
echo " Stack: $STACK_NAME | Region: $REGION"
echo "================================================"
echo ""
echo -e "${YELLOW}WARNING: This will permanently delete all resources.${NC}"
echo "Type 'yes' to confirm:"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""

# Get bucket name before deleting stack
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text 2>/dev/null || echo "")

# Empty S3 bucket (required before stack delete)
if [ -n "$BUCKET" ]; then
  echo "Emptying S3 bucket: $BUCKET..."
  aws s3 rm "s3://$BUCKET/" --recursive --region "$REGION" || true
  echo -e "${GREEN}✓ S3 bucket emptied${NC}"
fi

# Delete CloudFormation stack
echo "Deleting CloudFormation stack: $STACK_NAME..."
aws cloudformation delete-stack \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo "Waiting for stack deletion..."
aws cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION" && \
  echo -e "${GREEN}✓ Stack deleted${NC}" || \
  echo -e "${RED}✗ Stack deletion failed or timed out. Check AWS Console.${NC}"

echo ""
echo "================================================"
echo -e "${GREEN} Teardown complete!${NC}"
echo "================================================"
echo ""
echo "Note: The AWS Budget (BorewellLedger-Budget) was NOT deleted."
echo "This is intentional — it's a cost safeguard independent of the app."
echo "To delete it manually:"
echo "  ACCOUNT=\$(aws sts get-caller-identity --query Account --output text)"
echo "  aws budgets delete-budget --account-id \$ACCOUNT --budget-name BorewellLedger-Budget"
echo ""
echo "Note: The SAM deployment S3 bucket (sam-app-...) may remain."
echo "Check and delete if needed: aws s3 ls | grep aws-sam"
