# Borewell Ledger — Hackathon Submission Writeup

**Track**: Environmental Hacks — Heat and Water (Groundwater)
**Event**: WeMakeDevs × AWS Environmental Hackathon 2024
**Team**: Devtwin

---

## The Problem

India's groundwater crisis is largely invisible until it is too late. Millions of borewells serve housing societies, farms and villages, but almost no community has a system to:
- Track water levels over time in a shared, accessible way
- Compare their well's decline against nearby wells
- Receive early warnings before the well runs dry
- Understand *why* the decline is happening and *what to do*

The Central Ground Water Board publishes regional data, but it's not granular, not real-time, and not accessible to the average society secretary or farmer.

---

## What We Built

**Borewell Ledger** is a community-run, mobile-first early-warning system.

Key capabilities:
1. **Log** borewell depth readings (with offline support)
2. **Analyse** the decline rate using OLS regression on the last 90 days
3. **Compare** with nearby wells within 3 km (peer analysis)
4. **Alert** when a well declines significantly faster than peers (CRITICAL/WATCH), and detect area-wide crises when a whole locality declines together
5. **AI layer**: Amazon Bedrock (Nova Micro) explains what's happening, suggests water-saving measures adapted to the user's role (society, farmer, officer, NGO), and answers questions in English, Hindi or Gujarati
6. **Transparency**: all demo data is clearly labeled, all thresholds are documented as "starting assumptions", AI output is always attributed (ai vs template)

---

## Where AWS Fits

Every production piece runs on AWS:

| Component | AWS Service | Why This One |
|-----------|-------------|--------------|
| Frontend hosting | S3 + CloudFront | Free Tier, global CDN, no server to manage |
| REST API | API Gateway HTTP API | Per-request billing, native throttling |
| Compute | Lambda (Python 3.12, arm64) | Zero idle cost, Graviton for efficiency |
| Data | DynamoDB on-demand | No provisioned capacity needed at this scale |
| Scheduling | EventBridge ScheduleV2 | Serverless cron for daily analysis |
| Notifications | SNS | Simple email without a mail server |
| AI | Amazon Bedrock (Nova Micro) | Converse API, cheapest capable model, stays in AWS |
| IaC | AWS SAM (open-source) | One-file deployment, `sam deploy` tears down everything |
| Cost guard | AWS Budgets | Hard cap at $5/month — no surprise bills |

No NAT Gateways, no EC2, no RDS, no reserved capacity of any kind. The app costs **~$0 when idle**.

---

## AI Tools Used in Building This

- **IBM Bob** (Claude Sonnet 3.5) — primary coding agent, wrote the complete codebase end-to-end
- **GitHub Copilot** — inline suggestions during manual review

---

## Limitations (Honest)

- Status thresholds (CRITICAL: ≥0.8 m/mo and ≥2.5× peer) are calibrated guesses. Real thresholds need hydrogeological validation.
- Demo data is entirely synthetic — no real borewell measurements.
- Official CGWB data is not yet integrated.
- No authentication — trust is community-based and readings are traceable by source.
- AI analysis depends on Bedrock availability; template fallbacks are functional but less insightful.
- No sensor integration yet (readings are manual).

---

## What Would Make This Production-Ready

1. **Threshold calibration** with real hydrology data from CGWB and state water boards
2. **WhatsApp input** (Twilio / AWS Connect) so users without smartphones can log readings via SMS
3. **IoT sensor integration** for automated readings from low-cost water-level sensors
4. **Rainfall correlation** — overlay IMD rainfall data to separate seasonal recharge from over-extraction
5. **Authority dashboard** — read-only view for Panchayat water officers with PDF reports
6. **Login / multi-tenancy** — the code is structured to add an auth step without a full rewrite
