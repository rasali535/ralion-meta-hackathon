# MARI Growth Autopilot — Meta AI Edition (Meta Hackathon 2026)

> Autonomous Growth Intelligence Engine powered by Meta AI models and co-authored with Meta Muse Code CLI.

[![Meta AI OS Foundation](https://github.com/rasali535/ralion-meta-hackathon/actions/workflows/meta-os.yml/badge.svg)](https://github.com/rasali535/ralion-meta-hackathon/actions/workflows/meta-os.yml)
[![Tests Passing](https://img.shields.io/badge/tests-55%20passing-brightgreen.svg)](#run-the-test-suites-locally)
[![Meta Models Verified](https://img.shields.io/badge/Meta%20Models-Spark%20%7C%20Wonder%20%7C%20Image-blue.svg)](docs/AI_DEVELOPMENT_EVIDENCE.md)
[![Co-Authored with Muse Code](https://img.shields.io/badge/Built%20With-Meta%20Muse%20Code-purple.svg)](docs/MUSE_CODE_DEVELOPMENT.md)

---

## What We Built

**MARI Growth Autopilot** is an autonomous marketing and growth intelligence engine built for small-to-medium businesses. It takes raw business context, safely extracts grounded evidence from public websites, applies **Meta AI reasoning models** to identify high-leverage growth opportunities, synthesizes brand-aligned creative concepts, and constructs Facebook and Instagram campaign drafts—all governed by a **cryptographic human approval gateway**.

### The Autonomous Workflow Loop:
1. **Intake & Grounded Ingestion**: User provides business context and a website. An SSRF-safe ingestion engine extracts grounded text evidence with SHA-256 verification.
2. **Fast Diagnosis (Meta Muse Spark 1.3)**: Rapidly assesses audience opportunities and diagnoses growth bottlenecks.
3. **Deep Strategic Reasoning (Meta Muse Wonder 1.0)**: Deploys high-effort reasoning (`effort: high`, auto summary) to formulate testable marketing hypotheses.
4. **Multimodal Concept Generation (Meta Muse Image 1.0)**: Generates verified on-brand campaign visual assets with automated HTTP retrieval validation.
5. **Campaign Planning**: MARI structures channel-specific Facebook and Instagram briefs.
6. **Cryptographic Human Approval**: External actions require signed, role-checked authorizations bound to the exact mission hash. All drafts default to `LOCAL_DRAFT_ONLY`.
7. **Production Isolation**: Zero connection to production databases, ad spending accounts, or client records.

---

## Meta AI Integration Matrix

| Meta AI Component | Role in Ralion OS | Verification Status |
| :--- | :--- | :--- |
| **Meta Muse Code CLI** (`muse`) | Developer-side pair programming CLI; authored website ingest, auth & rate limiting. | **ACTIVE & VERIFIED** (OAuth Device Code) |
| **Meta Muse Spark 1.3** (`muse-spark-1.3`) | Fast runtime reasoning for MARI Growth Autopilot. | **VERIFIED LIVE** (`resp_6ae0ff1b9215a46fe33a464a`, 4,710 ms) |
| **Meta Muse Wonder 1.0** (`muse-wonder-1.0`) | High-effort deep reasoning for strategic campaign hypothesis generation. | **VERIFIED LIVE** (`effort: high`, auto summary) |
| **Meta Muse Image 1.0** (`muse-image-1.0`) | Multimodal creative asset generation with live CDN retrieval verification. | **VERIFIED LIVE** (Live HEAD/GET asset check) |
| **Meta SAM 3.1** (`sam-3.1`) | Visual asset segmentation and cutout preparation. | Staged Interface Contract |

Detailed technical evidence: [AI_DEVELOPMENT_EVIDENCE.md](docs/AI_DEVELOPMENT_EVIDENCE.md) and [MUSE_CODE_DEVELOPMENT.md](docs/MUSE_CODE_DEVELOPMENT.md).

---

## Co-Development with Meta Muse Code

This repository was engineered through a dual-agent workflow coordinating **Meta Muse Code CLI** (`muse`) in the terminal and **Antigravity (Anti)** in the IDE:
- **Muse Code authored**: The SSRF-guarded website ingestion engine (`lib/website.js`), mission evidence citations (`lib/mission.js`), stateless HMAC access tokens (`lib/auth.js`), and the token-bucket rate limiter (`lib/ratelimit.js`) across 29 dedicated unit tests.
- **Anti authored**: Repository contracts (`src/contracts/`), per-workspace budget ledgers (`lib/budget.js`), the cryptographic human approval gateway (`lib/approval.js`), and live probe test harnesses (`scripts/live-probes.mjs`).

See [docs/MUSE_CODE_DEVELOPMENT.md](docs/MUSE_CODE_DEVELOPMENT.md) for full audit trail.

---

## Run the Test Suites Locally

The project includes **55 passing automated tests** with zero external test runner dependencies (uses native Node.js `node:test`):

```bash
# 1. Run root prototype contracts & approval tests (9 tests)
npm test

# 2. Run Meta OS Next.js tests, ingest, auth, rate limit & budget tests (46 tests)
npm --prefix apps/meta-os test
```

All 55 tests pass deterministically offline without billable API calls.

---

## Run the Web Application Locally

Requires **Node.js 20** or newer.

```bash
# Navigate to the Meta OS Next.js application
cd apps/meta-os
npm install
npm run dev
```

Open [http://localhost:3600](http://localhost:3600) in your browser:
1. **Workspace**: Experience the unified Ralion OS interface.
2. **Business**: Enter a business profile and website URL.
3. **MARI**: Generate a unified mission draft connecting Growth, Creative, and Social.
4. **Activity**: View the grounded website evidence with verified SHA-256 hashes and word counts.
5. **Approval**: Confirm all campaign proposals are strictly marked `DRAFT_ONLY · NOT APPROVED · NOT PUBLISHED`.

---

## Safety, Privacy & Production Isolation

- **Clean-Room Incubation**: Developed as an isolated worktree. No code, customer data, or database migrations are copied from production Ralion OS (`alinew`).
- **Zero Exposed Credentials**: API keys remain strictly server-side in environment variables (`MODEL_API_KEY`). No secrets belong in `.env.example`, client bundles, or Git.
- **Inference Quotas & Budgets**: In-memory token buckets (10/min burst, 200/day) and daily workspace budgets prevent runaway costs.
- **SSRF Defense**: The website reader pre-resolves DNS and strictly blocks loopback, private RFC 1918 subnets, IPv6 mapped addresses, and redirect bounce attacks.
- **Human Approval Gate**: External publishing and advertising spend are disabled. Approvals are cryptographically signed and bound to the immutable plan hash.

---

## Repository Documentation

* [docs/AI_DEVELOPMENT_EVIDENCE.md](docs/AI_DEVELOPMENT_EVIDENCE.md) — Judge-facing summary of Meta AI integrations and test matrix.
* [docs/MUSE_CODE_DEVELOPMENT.md](docs/MUSE_CODE_DEVELOPMENT.md) — Verifiable evidence of Meta Muse Code CLI contributions.
* [docs/PHASE_1_5_VALIDATION_STATUS.md](docs/PHASE_1_5_VALIDATION_STATUS.md) — Live validation log for Spark, Wonder, and Muse Image.
* [docs/RALION_REINTEGRATION_ARCHITECTURE.md](docs/RALION_REINTEGRATION_ARCHITECTURE.md) — Upstream architectural reintegration blueprint for Ralion OS.
* [docs/SECURITY.md](docs/SECURITY.md) — Threat model and security controls.
