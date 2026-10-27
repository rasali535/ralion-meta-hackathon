# Meta AI Development Evidence & Hackathon Judging Guide

This document summarizes the comprehensive integration of **Meta AI technologies** in the Ralion Meta Hackathon deliverable, spanning both **development-time tooling** (Meta Muse Code CLI) and **runtime autonomous intelligence** (Meta Model APIs).

---

## 1. Executive Summary

| Layer | Technology | Role | Status |
| :--- | :--- | :--- | :--- |
| **Development Assistant** | **Meta Muse Code CLI** (`muse`) | Pair programmer in terminal, author of ingestion, auth & rate limiting subsystems. | **ACTIVE & VERIFIED** (OAuth Device Code) |
| **Fast Runtime Reasoning** | **Meta Muse Spark 1.3** (`muse-spark-1.3`) | Real-time diagnostic reasoning, audience opportunity analysis in MARI. | **VERIFIED LIVE** (`resp_6ae0ff1b9215a46fe33a464a`, 4,710 ms) |
| **Deep Strategic Reasoning** | **Meta Muse Wonder 1.0** (`muse-wonder-1.0`) | High-effort strategic hypothesis generation, synthesis of cross-channel growth plans. | **VERIFIED LIVE** (High effort + auto summary) |
| **Multimodal Creative** | **Meta Muse Image 1.0** (`muse-image-1.0`) | On-brand visual concept generation producing verified CDN media assets. | **VERIFIED LIVE** (Live HEAD/GET asset verification) |
| **Visual Segmentation** | **Meta SAM 3.1** (`sam-3.1`) | Product cutouts and asset preparation. | Staged Interface Contract |

---

## 2. Meta Muse Code: Developer-Time Evidence

Unlike projects that merely use an API at runtime, Ralion Meta OS was **co-authored using Meta's official developer CLI (`muse`)**:

1. **Authenticated Session**: Configured via OAuth Device Code against `https://api.meta.ai/v1`, stored in `~/.config/muse/auth.json` with trusted project markers in `trust.json`.
2. **Subsystems Authored by Muse Code**:
   - **Guarded Website Ingestion** ([lib/website.js](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/lib/website.js)): Pre-fetch DNS SSRF guards, RFC 1918 blocking, redirect validation, and SHA-256 evidence hashing (13 tests in [website-ingest.test.mjs](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/tests/website-ingest.test.mjs)).
   - **Mission Evidence Pipeline** ([lib/mission.js](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/lib/mission.js)): Citations, content length caps, and audit tagging (5 tests in [mission-evidence.test.mjs](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/tests/mission-evidence.test.mjs)).
   - **Stateless HMAC Authentication** ([lib/auth.js](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/lib/auth.js)): Timing-safe token verification, TTL clamping, and workspace isolation (6 tests in [auth.test.mjs](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/tests/auth.test.mjs)).
   - **Token-Bucket Rate Limiter** ([lib/ratelimit.js](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/lib/ratelimit.js)): Per-workspace 10/min burst and 200/day sustained controls with HTTP 429 headers (5 tests in [ratelimit.test.mjs](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/tests/ratelimit.test.mjs)).
3. **Collaboration with Anti (Antigravity)**: Anti provided repository scaffolding, portable contracts, budget ledgers, and live probe test harnesses, creating a unified dual-agent engineering pipeline.

---

## 3. Meta Model APIs: Runtime Intelligence

MARI (Marketing Autonomous Reasoning Intelligence) coordinates three Meta models through server-side transports:

### 1. Muse Spark 1.3 (`muse-spark-1.3`)
- **Transport**: `POST https://api.meta.ai/v1/responses`
- **Role**: High-velocity opportunity identification and initial diagnosis.
- **Verification Evidence**:
  - Request ID: `resp_6ae0ff1b9215a46fe33a464a`
  - Latency: `4,710 ms`
  - Grounding: Bound to verified business facts; claims source explicitly tagged as `USER_SUPPLIED_UNVERIFIED`.

### 2. Muse Wonder 1.0 (`muse-wonder-1.0`)
- **Transport**: `POST https://api.meta.ai/v1/responses`
- **Role**: Deep strategic reasoning requiring high cognitive effort.
- **Reasoning Payload**: `{ effort: "high", summary: "auto" }`
- **Output**: Structured multi-step growth hypothesis, recommended action, and measurable metric.

### 3. Muse Image 1.0 (`muse-image-1.0`)
- **Transport**: `POST https://api.meta.ai/v1/images/generations`
- **Role**: Creative concept visual generation for Facebook and Instagram campaign briefs.
- **Asset Verification Guarantee**: The system validates that generated media is real by issuing a verified `HEAD`/`GET` HTTP request against the returned URL, checking for HTTP 200, valid `image/*` MIME type, and non-zero byte size before returning `reviewRequired: true`.

---

## 4. Production Isolation & Ethical Guardrails

Ralion OS enforces uncompromising safety and isolation boundaries:

1. **No Phantom Actions**: MARI never claims to have executed an ad campaign or spent money. All proposals default to `LOCAL_DRAFT_ONLY`.
2. **Cryptographic Human Approval Gateway** ([lib/approval.js](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/lib/approval.js)):
   - Every external action demands explicit, signed human approval from an authorized role (`owner`, `growth_admin`, `marketing_lead`).
   - The approval is cryptographically bound via HMAC-SHA256 to a deterministic hash of the exact mission plan (`planHash`). Any post-approval change invalidates the approval.
3. **Inference Budgets & Cost Accounting** ([lib/budget.js](file:///c:/Users/Ras%20Ali%20Labs/Desktop/meta%20hack/ralion-meta-hackathon/apps/meta-os/lib/budget.js)):
   - Per-workspace daily caps (100 Spark calls, 25 Wonder calls, 10 Image calls) prevent accidental billable exhaustion.
4. **Strict Isolation from Production Ralion OS**:
   - Zero database credentials, Supabase tables, Stripe accounts, or customer records from production Ralion OS (`alinew`) are imported.
   - The hackathon repository operates as a standalone, clean-room incubation worktree.

---

## 5. Automated Verification Matrix

The repository contains **55 passing automated tests** with zero external runtime dependencies:

```
======================================================================
TEST SUITE SUMMARY (All suites pass natively via node:test)
======================================================================
1.  tests/businessIntake.test.js           3 tests  (URL & facts intake)
2.  tests/campaignPlan.test.js             2 tests  (Channel & proposal contracts)
3.  tests/engine.test.js                   4 tests  (Approval gate & evidence engine)
4.  apps/meta-os/tests/approval.test.mjs   4 tests  (Cryptographic approval & role checks)
5.  apps/meta-os/tests/auth.test.mjs       6 tests  (Stateless HMAC tokens & TTL clamping)
6.  apps/meta-os/tests/budget.test.mjs     4 tests  (Per-workspace daily quotas & rollover)
7.  apps/meta-os/tests/live-probes.test.mjs3 tests  (Wonder/Image contract dry-runs)
8.  apps/meta-os/tests/meta-provider.test.mjs 6 tests (Model IDs, endpoints & parsing)
9.  apps/meta-os/tests/mission-evidence.test.mjs 5 tests (Grounded website citations)
10. apps/meta-os/tests/ratelimit.test.mjs  5 tests  (Token-bucket sliding window & burst)
11. apps/meta-os/tests/website-ingest.test.mjs 13 tests (SSRF, DNS, redirect & byte caps)
----------------------------------------------------------------------
TOTAL: 55 TESTS PASSING (0 FAILING)
======================================================================
```

---

## 6. How Judges Can Verify the Submission

### Verification Step 1: Run All Automated Tests Locally
```bash
# In project root (9 core tests)
npm test

# In apps/meta-os (46 Next.js & Meta AI tests)
npm --prefix apps/meta-os test
```

### Verification Step 2: Launch the Next.js Unified OS Interface
```bash
cd apps/meta-os
npm install
npm run dev
# Open http://localhost:3600
```
- Navigate to **Business Intake**: Enter a business name, growth objective, and website.
- Experience **MARI Orchestrator**: Review the sequenced mission linking Business context → Growth Diagnosis → Creative Brief → Social Campaign Drafts.
- Inspect **Activity**: Verify that retrieved website evidence displays verified content hashes, word counts, and citation links.
- Confirm **Approval Gate**: Review that campaigns remain explicitly marked `DRAFT_ONLY · NOT APPROVED · NOT PUBLISHED`.
