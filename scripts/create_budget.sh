#!/usr/bin/env bash
# create_budget.sh - Create AWS Budget safeguard (run once, not part of app stack)
# Budget persists even after stack teardown.
set -euo pipefail

BUDGET_LIMIT="${BUDGET_LIMIT_USD:-5}"
ALERT_EMAIL="${ALERT_EMAIL:-pravinchoudhary3108@gmail.com}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUDGET_NAME="BorewellLedger-Budget"

echo "Checking if budget '$BUDGET_NAME' already exists..."

# Check if budget exists
if aws budgets describe-budget --account-id "$ACCOUNT_ID" --budget-name "$BUDGET_NAME" &>/dev/null; then
  echo "✓ Budget '$BUDGET_NAME' already exists. Skipping creation."
  exit 0
fi

echo "Creating AWS Budget: $BUDGET_NAME (limit: \$$BUDGET_LIMIT)"

aws budgets create-budget \
  --account-id "$ACCOUNT_ID" \
  --budget "{
    \"BudgetName\": \"$BUDGET_NAME\",
    \"BudgetLimit\": {
      \"Amount\": \"$BUDGET_LIMIT\",
      \"Unit\": \"USD\"
    },
    \"TimeUnit\": \"MONTHLY\",
    \"BudgetType\": \"COST\"
  }" \
  --notifications-with-subscribers "[
    {
      \"Notification\": {
        \"NotificationType\": \"ACTUAL\",
        \"ComparisonOperator\": \"GREATER_THAN\",
        \"Threshold\": 50,
        \"ThresholdType\": \"PERCENTAGE\"
      },
      \"Subscribers\": [{\"SubscriptionType\": \"EMAIL\", \"Address\": \"$ALERT_EMAIL\"}]
    },
    {
      \"Notification\": {
        \"NotificationType\": \"ACTUAL\",
        \"ComparisonOperator\": \"GREATER_THAN\",
        \"Threshold\": 80,
        \"ThresholdType\": \"PERCENTAGE\"
      },
      \"Subscribers\": [{\"SubscriptionType\": \"EMAIL\", \"Address\": \"$ALERT_EMAIL\"}]
    },
    {
      \"Notification\": {
        \"NotificationType\": \"ACTUAL\",
        \"ComparisonOperator\": \"GREATER_THAN\",
        \"Threshold\": 100,
        \"ThresholdType\": \"PERCENTAGE\"
      },
      \"Subscribers\": [{\"SubscriptionType\": \"EMAIL\", \"Address\": \"$ALERT_EMAIL\"}]
    }
  ]"

echo "✓ Budget created: $BUDGET_NAME (\$$BUDGET_LIMIT/month)"
echo "  Email alerts at 50%, 80%, 100% → $ALERT_EMAIL"
echo "  Note: Budget persists after stack teardown (cost safeguard)."
