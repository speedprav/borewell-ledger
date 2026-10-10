#!/usr/bin/env bash
# deploy.sh - Full idempotent deploy for Borewell Ledger
# Usage: ./scripts/deploy.sh [--region ap-south-1] [--stack-name borewell-ledger]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
STACK_NAME="${STACK_NAME:-borewell-ledger}"
ALERT_EMAIL="${ALERT_EMAIL:-pravinchoudhary3108@gmail.com}"
BEDROCK_MODEL="${BEDROCK_MODEL_ID:-amazon.nova-micro-v1:0}"
BEDROCK_REGION="${BEDROCK_REGION:-us-east-1}"
ENVIRONMENT="prod"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================================"
echo " Borewell Ledger — Full Deploy"
echo " Stack: $STACK_NAME | Region: $REGION"
echo "================================================"
echo ""

cd "$ROOT_DIR"

# ── Step 1: Preflight ─────────────────────────────────────────────────────────
echo "Step 1/7: Preflight checks..."
bash "$SCRIPT_DIR/preflight.sh"
echo ""

# ── Step 2: Budget Safeguard ──────────────────────────────────────────────────
echo "Step 2/7: Creating cost budget..."
bash "$SCRIPT_DIR/create_budget.sh"
echo ""

# ── Step 3: SAM Build + Deploy ─────────────────────────────────────────────────
echo "Step 3/7: Building and deploying backend (SAM)..."
sam build --region "$REGION"

sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "AlertEmail=$ALERT_EMAIL" \
    "BedrockModelId=$BEDROCK_MODEL" \
    "BedrockRegion=$BEDROCK_REGION" \
    "Environment=$ENVIRONMENT"

echo -e "${GREEN}✓ Backend deployed${NC}"
echo ""

# ── Step 4: Get Stack Outputs ──────────────────────────────────────────────────
echo "Step 4/7: Getting stack outputs..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)
CF_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text)
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)
CF_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

echo "  API URL: $API_URL"
echo "  CloudFront URL: $CF_URL"
echo "  S3 Bucket: $BUCKET"
echo ""

# ── Step 5: Seed Data ─────────────────────────────────────────────────────────
echo "Step 5/7: Seeding demo data..."
python3 "$SCRIPT_DIR/seed.py" --stack-name "$STACK_NAME" --region "$REGION" || {
  echo -e "${YELLOW}⚠ Seed script failed. You can run it manually:${NC}"
  echo "  python3 scripts/seed.py --stack-name $STACK_NAME --region $REGION"
}
echo ""

# ── Step 6: Frontend Build + Deploy ───────────────────────────────────────────
echo "Step 6/7: Building and deploying frontend..."
cd "$ROOT_DIR/frontend"

# Write runtime config
cat > public/config.json << EOF
{
  "apiUrl": "$API_URL",
  "version": "$(git rev-parse --short HEAD 2>/dev/null || echo 'dev')"
}
EOF

# Install and build
npm ci
npm run build

# Sync to S3 with correct cache headers
# Long cache for hashed assets (JS/CSS)
aws s3 sync dist/ "s3://$BUCKET/" \
  --region "$REGION" \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "*.html" \
  --exclude "config.json"

# No-cache for HTML and config.json
aws s3 sync dist/ "s3://$BUCKET/" \
  --region "$REGION" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --include "*.html" \
  --include "config.json"

# Also put config.json directly
aws s3 cp public/config.json "s3://$BUCKET/config.json" \
  --region "$REGION" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "application/json"

echo -e "${GREEN}✓ Frontend deployed to S3${NC}"

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id "$CF_ID" \
  --paths "/*" \
  --region "$REGION" > /dev/null

echo -e "${GREEN}✓ CloudFront invalidated${NC}"
cd "$ROOT_DIR"
echo ""

# ── Step 7: Smoke Test ────────────────────────────────────────────────────────
echo "Step 7/7: Running smoke tests..."
API_URL="$API_URL" bash "$SCRIPT_DIR/smoke_test.sh" || {
  echo -e "${YELLOW}⚠ Some smoke tests failed. Check above output.${NC}"
}
echo ""

# ── Final Output ──────────────────────────────────────────────────────────────
echo "================================================"
echo -e "${GREEN} ✓ Borewell Ledger deployed successfully!${NC}"
echo "================================================"
echo ""
echo "  🌐 Live app:   $CF_URL"
echo "  🔌 API URL:    $API_URL"
echo "  📍 Region:     $REGION"
echo "  🤖 AI Model:   $BEDROCK_MODEL ($BEDROCK_REGION)"
echo ""
echo "  ⚠️  HUMAN STEPS REQUIRED:"
echo "  1. Check email ($ALERT_EMAIL) for SNS subscription confirmation"
echo "     and CLICK THE LINK to enable alert emails."
echo "  2. Push to GitHub: https://github.com/speedprav/borewell-ledger"
echo ""
echo "  💡 Estimated monthly cost: ~\$0 (Free Tier + minimal usage)"
echo ""
echo "  🗑️  To tear down: bash scripts/teardown.sh"
echo ""
echo "  ✉️  outputs.json written for reference."

# Save outputs
cat > "$ROOT_DIR/outputs.json" << EOF
{
  "apiUrl": "$API_URL",
  "cloudFrontUrl": "$CF_URL",
  "s3Bucket": "$BUCKET",
  "cloudFrontId": "$CF_ID",
  "region": "$REGION",
  "bedrockModel": "$BEDROCK_MODEL",
  "bedrockRegion": "$BEDROCK_REGION",
  "stackName": "$STACK_NAME"
}
EOF
