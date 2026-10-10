# Borewell Ledger

> **Know your groundwater before it runs dry.**

A community groundwater early-warning platform for India. Housing societies, farmers, water officers and NGOs log depth-to-water readings from borewells. The app shows a shared map, compares each well's decline rate with nearby wells (peer comparison), raises alerts, and has an AI layer powered by Amazon Bedrock.

**🏆 WeMakeDevs × AWS Environmental Hackathon 2024 — Track: Heat and Water (Groundwater)**

---

## ⚠️ Demo Data Notice

All data currently displayed is **simulated demo data** for demonstration purposes. It is clearly labeled with a "Demo data" badge throughout the UI, in the data-sources table on the About page, and in this README. It does **not** represent real groundwater readings.

---

## Live URLs

| | |
|---|---|
| **Live App (HTTP)** | http://borewell-ledger-frontend-796973511540-prod.s3-website.ap-south-1.amazonaws.com |
| **API URL** | https://r0kskruke2.execute-api.ap-south-1.amazonaws.com/prod |
| **Region** | `ap-south-1` (Bedrock: `us-east-1`) |
| **Bedrock Model** | `amazon.nova-micro-v1:0` |

> **Note on HTTPS / CloudFront**: The app is currently served over HTTP from S3 static website hosting. A CloudFront distribution (HTTPS, OAC, Price Class 100) is defined in `template.yaml` and ready to deploy, but requires AWS account verification (support case submitted). Once verified, run `sam deploy` to enable CloudFront and update this URL. GPS ("Use My Location") requires HTTPS and will work automatically after CloudFront is active.

---

## Quick Start — Deploy Everything

```bash
# Prerequisites: AWS CLI configured, SAM CLI installed, Node 18+, Python 3.12+
git clone https://github.com/speedprav/borewell-ledger
cd borewell-ledger
bash scripts/deploy.sh
```

The script:
1. Runs preflight checks (tools, credentials, Bedrock model)
2. Creates a cost-guard AWS Budget ($5/month, alerts at 50/80/100%)
3. `sam build && sam deploy` (Lambda, API Gateway, DynamoDB, SNS, S3, CloudFront, EventBridge)
4. Seeds ~40 demo wells around Vadodara
5. Builds the React frontend and syncs to S3
6. Invalidates CloudFront
7. Runs smoke tests against every endpoint
8. Prints the live URL

---

## Architecture

```
Browser → CloudFront (HTTPS, SPA) → S3 (private, OAC)
Browser → API Gateway (HTTP API) → Lambda (Python 3.12, arm64)
Lambda → DynamoDB (on-demand, 4 tables)
Lambda → SNS (email alerts)
Lambda → Bedrock Converse API (AI)
EventBridge → Analyzer Lambda (daily schedule)
```

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **S3** | Private static hosting for React SPA |
| **CloudFront** | HTTPS CDN, OAC, SPA 404→index.html fallback, Price Class 100 |
| **API Gateway (HTTP API)** | CORS-secured REST API, per-route throttling (burst 20, rate 10/s) |
| **Lambda (Python 3.12, arm64)** | All compute — 11 functions, no idle billing |
| **DynamoDB (on-demand)** | 4 tables: Wells, Readings, Alerts, Meta (TTL) |
| **EventBridge ScheduleV2** | Daily analyzer (`rate(1 day)`) |
| **SNS** | Email alerts for CRITICAL and area-wide events |
| **Amazon Bedrock** | Converse API — Nova Micro for AI analysis, plan, chat |
| **AWS SAM** | Open-source IaC — entire stack in `template.yaml` |
| **AWS Budgets** | Cost guard at $5/month (separate from app stack) |
| **AWS CloudFormation** | Underlying IaC engine |

All forbidden services (NAT Gateway, EC2, ECS, RDS, OpenSearch, SageMaker, WAF, load balancers, provisioned DynamoDB, reserved Lambda concurrency) are **not used**.

---

## Repository Layout

```
borewell-ledger/
  template.yaml              # SAM: all infrastructure
  samconfig.toml             # non-secret defaults
  backend/
    common/                  # analysis.py, geo.py, validate.py, ddb.py,
    │                        # ai.py, ratelimit.py, templates.py
    handlers/                # map.py, wells.py, readings.py, alerts.py,
    │                        # community.py, admin.py, ai_analyze.py,
    │                        # ai_plan.py, ai_chat.py, analyzer.py, health.py
    tests/                   # pytest — 39 tests, all pure functions
  frontend/                  # React 18 + Vite + TypeScript + Tailwind
  scripts/
    preflight.sh             # tool/credential check
    create_budget.sh         # AWS Budgets safeguard (run once)
    seed.py                  # ~40 demo wells, idempotent, --reset flag
    deploy.sh                # full deploy, one command, idempotent
    smoke_test.sh            # curl every endpoint, check shapes
    teardown.sh              # empty bucket + delete stack
  docs/
    architecture.md          # Mermaid diagram
    WRITEUP.md               # Hackathon submission writeup
    DEMO_SCRIPT.md           # 3-minute video script
  README.md
```

---

## Analysis Rules (Deterministic)

All documented in [`backend/common/analysis.py`](backend/common/analysis.py) and unit-tested.

| Rule | Value | Label |
|------|-------|-------|
| Analysis window | Last 90 days | |
| Min readings required | 3 readings spanning 14+ days | |
| Decline rate | OLS slope, meters/month (positive = falling) | |
| Peer radius | 3 km haversine | |
| Min peers | 3 wells with computed slopes | |
| **CRITICAL** threshold | slope ≥ 0.8 m/mo AND ≥ 2.5× peer median | Starting value |
| **WATCH** threshold | slope ≥ 0.3 m/mo AND ≥ 1.5× peer median | Starting value |
| Area alert | ≥ 5 wells in locality, median slope ≥ 0.5 m/mo | |
| Large jump warning | >3 m change vs previous reading (flag, not reject) | |

These thresholds are **starting assumptions**, clearly labeled as such in the UI About page.

---

## AI Layer

- **Model**: Amazon Nova Micro (`amazon.nova-micro-v1:0`) via Bedrock Converse API
- **Bedrock Region**: `us-east-1` (Nova Micro availability)
- **Fallback**: Every AI call gracefully falls back to deterministic template text (marked "Template advice — AI unavailable") — the app is fully usable without Bedrock
- **Cost controls**: maxTokens 450 (analyze/plan), 350 (chat); caching in Meta table (24h TTL); daily caps: 300 total, 30 per hashed IP; temperature 0.3
- **Prompt safety**: user-provided text (names, notes, chat) is placed in delimited DATA BLOCK sections; model is instructed to treat them as data only
- **Sources**: chat `sources` (readingsUsed, peersUsed, alertIdsReferenced) are computed server-side, never by the model

---

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| Lambda (arm64, 256 MB, on-demand) | ~$0 (Free Tier) |
| DynamoDB (on-demand, low traffic) | ~$0 (Free Tier) |
| API Gateway (HTTP API) | ~$0 (Free Tier) |
| S3 + CloudFront | ~$0 (Free Tier / Price Class 100) |
| SNS | ~$0 (Free Tier) |
| Bedrock (Nova Micro) | ~$0.01–$0.10 depending on usage |
| **Total** | **~$0 idle, <$1 light demo use** |

---

## Human-Only Steps

After `scripts/deploy.sh` completes, you must:

1. **Confirm SNS email subscription** — Check `pravinchoudhary3108@gmail.com` for an AWS SNS confirmation email and click the link to enable alert notifications.
2. **Push to GitHub** — `git push origin main` to https://github.com/speedprav/borewell-ledger (you need to create the repo first if not done).

---

## Tear Down

```bash
bash scripts/teardown.sh
```

Empties the S3 bucket and deletes the CloudFormation stack. The AWS Budget is **intentionally not deleted** — it's a cost safeguard independent of the app stack.

To also delete the budget:
```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws budgets delete-budget --account-id $ACCOUNT --budget-name BorewellLedger-Budget
```

---

## AI Coding Tools Used

- **IBM Bob** (Claude Sonnet 3.5) — primary agent, wrote the entire codebase
- **GitHub Copilot** — inline suggestions during manual edits

---

## What is Simulated / Template-Based

- All demo data (40 wells, readings) — labeled `source: "seed"` throughout
- AI template fallbacks when Bedrock is unavailable — labeled "Template advice" in every response
- Status thresholds (CRITICAL/WATCH) are starting assumptions documented as such

---

## Frontend Tech Stack

React 18 · Vite · TypeScript · Tailwind CSS · React Router · MapLibre GL JS (OpenStreetMap tiles, attribution shown) · Recharts · lucide-react

---

## Contributing

See [`docs/WRITEUP.md`](docs/WRITEUP.md) for the full project writeup and [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) for the demo video script.
