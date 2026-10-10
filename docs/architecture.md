# Architecture — Borewell Ledger

## System Diagram

```mermaid
graph TD
    User[Browser / Mobile] -->|HTTPS| CF[CloudFront\nPrice Class 100\nSPA fallback]
    CF -->|OAC| S3[S3 Bucket\nPrivate, static frontend]
    User -->|HTTPS REST| APIGW[API Gateway\nHTTP API\nCORS + Throttling]
    APIGW --> Lambda_Map[GET /map\nLambda]
    APIGW --> Lambda_Wells[/wells/*\nLambda]
    APIGW --> Lambda_Readings[POST /readings\nLambda]
    APIGW --> Lambda_Alerts[/alerts/*\nLambda]
    APIGW --> Lambda_Community[GET /community\nLambda]
    APIGW --> Lambda_Admin[POST /admin/run-analysis\nLambda]
    APIGW --> Lambda_AI[/ai/*\nLambda 512MB\n25s timeout]
    Lambda_Map --> DDB[(DynamoDB\nWells\nReadings\nAlerts\nMeta)]
    Lambda_Wells --> DDB
    Lambda_Readings --> DDB
    Lambda_Alerts --> DDB
    Lambda_Community --> DDB
    Lambda_Admin --> Analyzer[Analyzer\nLambda\n60s]
    Analyzer --> DDB
    Analyzer --> SNS[SNS Topic\nEmail alerts]
    Lambda_AI --> Bedrock[Amazon Bedrock\nNova Micro\nConverse API]
    Lambda_AI --> DDB
    EB[EventBridge\nScheduleV2\nrate 1 day] --> Analyzer
    SNS -->|Email| User
    Budget[AWS Budgets\n$5/month guard] -.->|alerts| Email[pravinchoudhary3108\n@gmail.com]
```

## Per-Service Summary

| Service | Config | Notes |
|---------|--------|-------|
| S3 | Private, OAC only | No public access |
| CloudFront | Price Class 100, HTTPS redirect, SPA 404→200 | OAC to S3 |
| API Gateway | HTTP API, burst 20/rate 10 per-route; /ai/* burst 5/rate 2 | CORS: * (CloudFront template cycle workaround) |
| Lambda | Python 3.12, arm64, 256 MB (AI: 512 MB), timeout 10s (AI: 25s) | No X-Ray, log retention 14 days |
| DynamoDB | On-demand billing, 4 tables, Meta has TTL | No provisioned capacity |
| EventBridge | ScheduleV2, rate(1 day) | Triggers Analyzer |
| SNS | Email subscription to alert email | Published for new CRITICAL + AREA alerts only |
| Bedrock | Converse API, Nova Micro, us-east-1 | Graceful template fallback |
| Budgets | $5/month, alerts at 50/80/100% | Not in app stack — persists after teardown |
| SAM | Open-source IaC, template.yaml | All resources in one stack |
