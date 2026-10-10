# Demo Script — Borewell Ledger (3 minutes)

**Format**: Screen recording with voice-over. Show both mobile (375px) and desktop.

---

## [0:00–0:20] Hook — The Problem

> "India has 30 million borewells. Most communities have no idea how fast their water is disappearing — until the pump runs dry."

**Show**: Full-screen headline on Welcome page. Tagline: "Know your groundwater before it runs dry."

**Note**: Point out the "Demo data" badge — all data is simulated for this demonstration.

---

## [0:20–0:50] The Map — See Your Community

> "Open the map and instantly see every borewell's health status."

**Show**:
- Map page loading with 40 pins around Vadodara
- Color-coded: green (Normal), amber (Watch), red (Critical)
- Translucent red area-alert zone over Alkapuri
- Tap a critical well → bottom sheet with depth, rate, "View Details"
- Filter by "Critical" status → 4 wells remain

**AWS Console shot**: DynamoDB Wells table — show ~40 items with status column

---

## [0:50–1:20] Log a Reading

> "Anyone with a phone and a measuring tape can contribute."

**Show**:
- Add Reading → 3-step form
- Step 1: select "Sunrise Heights Society Borewell (Gotri)"
- Step 2: today's date, depth 28.5 m, pump-off condition
- Step 3: review → Submit
- Confirmation screen shows updated status (Watch → Critical transition)
- Large-jump warning if triggered

---

## [1:20–1:55] Well Detail + AI Analysis

> "Click any well to see the full trend, peer comparison, and AI-powered analysis."

**Show**:
- Well detail for a CRITICAL well
- Trend chart with declining line (Y axis inverted — deeper = lower)
- Peer comparison bars: "this well is 4.2× faster than nearby wells"
- Dry-out estimate: "6–11 months at current rate"
- Click "Get AI Analysis"
- AI card appears: What is happening / Possible reasons / Next steps
- Note the "Based on N readings, M nearby wells" footer
- If template fallback: show "Template advice" label

**AWS Console shot**: Lambda AI analyze function — recent invocations

---

## [1:55–2:25] AI Assistant + Water-Saving Plan

> "Ask the AI anything about your well — in English, Hindi or Gujarati."

**Show**:
- Assistant page with well pre-selected
- Type: "Why is my borewell declining so fast?"
- AI replies in under 5 seconds
- Switch language to ગુજરાતી → reply language changes
- Click "Water-Saving Plan" → Plan page with 3 tiers of measures
- Mark one measure as done → checkbox ticks, goal ring updates

**AWS Console shot**: Bedrock → Model invocations graph

---

## [2:25–2:50] Alerts + Run Analysis Now

> "Automated alerts so communities know where to look first."

**Show**:
- Alerts page → Critical tab (4 alerts), Area-wide tab (1 Alkapuri alert)
- Click "Run Analysis Now" button on Dashboard → toast: "Analysis complete"
- Alert card with rate comparison: "0.9 vs 0.2 m/month"
- Mark an alert as Resolved

**AWS Console shot**: EventBridge rule for daily analyzer

---

## [2:50–3:00] Close — Cost + Tear Down

> "The entire stack runs on AWS Free Tier. One command to deploy, one command to tear down."

**Show**:
- `bash scripts/deploy.sh` terminal (fast-forward)
- `bash scripts/teardown.sh` — one command deletes everything
- AWS Budgets dashboard: $5/month guard, $0.00 actual spend

**Final frame**: GitHub repo URL + CloudFront live URL + "WeMakeDevs × AWS Hackathon 2024"
