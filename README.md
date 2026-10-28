# MARI Growth Autopilot — Meta Hackathon 2026

Standalone, public submission worktree. This is **not** a mirror of production Ralion OS.

[![Tests](https://img.shields.io/badge/tests-157%20passing-brightgreen.svg)](#tests)
[![Meta models](https://img.shields.io/badge/Meta%20models-owner--reported%20live%20receipts-blue.svg)](docs/AI_DEVELOPMENT_EVIDENCE.md)
[![Muse Code](https://img.shields.io/badge/Muse%20Code-session%20log%20evidence-lightgrey.svg)](docs/MUSE_CODE_DEVELOPMENT.md)

## Scope
Business context → Meta-powered reasoning → evidence-backed growth action proposal → human approval → isolated action execution → measured outcome.

## Current status (honest summary)
- **Working and tested offline (157 tests):**
  - **Phase 1-2 Foundation:** DNS-pinned website transport (re-pinned every redirect hop to prevent TOCTOU DNS rebinding), mission planning with grounded evidence labels, v2 tenant-scoped tokens (`v2.<org>.<workspace>.<exp>.<sig>`), shared inference access guard with per-token rate limits and per-workspace daily inference budgets, signed human-approval records strictly locked to `LOCAL_DRAFT_ONLY` with `execution: NOT_CONNECTED`, responsive 8-workspace OS shell (Command Center, Business, MARI, Growth, Creative, Social, Activity, Settings) with dark/light theme switching, and Meta provider adapters (Spark, Wonder, Muse Image).
  - **Phase 3 Creative Studio & Social Gateway:** Guided brief selection (Growth, MARI, or Custom), editable prompt composer, explicit confirmation checkbox guard, server-side tenant-isolated binary asset storage (`.data/creative/`), magic byte type verification (`image/png`, `image/jpeg`, `image/webp`, `image/gif`), expiring HMAC-signed capability preview URLs (`GET /api/creative/asset?id=...&org=...&ws=...&exp=...&sig=...`), multi-channel draft generator (Facebook, Instagram) with grounded evidence chips and mandatory `NOT PUBLISHED · PUBLISHING NOT APPROVED` guard chips, thumbnail preview row, cryptographic human approval minting (`POST /api/mission/approve`), and exact plan hash binding that invalidates approvals upon draft modification.
  - **Post-Extraction Implementations:**
    1. *Canonical `SocialHandoffContract` packaging:* per-channel contract (`apps/meta-os/lib/social-handoff.js`) linking tenant, mission, primary asset, preview pointer, draft copy, `DRAFT_ONLY` + `NOT_CONNECTED`, bound to cryptographic approval.
    2. *Creative Studio requested-format controls:* format selection (1:1 Square, 4:5 Portrait, 9:16 Story) in `apps/meta-os/lib/creative-format.js` and `views/creative.jsx`, framing built prompts while keeping user prompts verbatim, asset metadata badge `Requested <format>` (without false claims of guaranteed pixel dimensions).
    3. *Tenant-scoped AI usage telemetry:* bounded in-memory buffer (`apps/meta-os/lib/telemetry.js`) and endpoint `GET /api/telemetry/usage` recording verified call facts (model, provider, requestId, tenant, latency, ok/fail, budget outcome) without fabricating tokens or logging sensitive data.
    4. *Read-only learning-loop inspector:* 7-stage inspector (`apps/meta-os/lib/learning-loop.js`) displayed on `ActivityView` (`apps/meta-os/app/views/activity.jsx`) with honesty badges `Publish NOT CONNECTED` and `Performance NOT AVAILABLE`.
- **Live Meta API receipts (reported by the project owner, not independently reproduced by the repo's automated tests):** Spark `resp_6ae0ff1b9215a46fe33a464a` (4,710 ms); Wonder `resp_6ae1034770c8117dac244a61` (6,081 ms); Muse Image 9,233 ms, image retrieved with HTTP 200 (`image/webp`, 298,186 bytes), request ID unavailable.
- **Live MARI integration:** Optional live MARI mission diagnosis (Spark/Wonder) behind explicit feature flags (`MARI_LIVE_REASONING_ENABLED=true` and master switch `META_REASONING_API_ENABLED=true`) plus demo token authentication, with automatic deterministic fallback if credentials or flags are absent or if inference fails.
- **Safety boundaries enforced:** Public demo mission flow defaults to deterministic demo without calling billable Meta models; the direct inference route is disabled by default; human approval records can never trigger live ad execution; approvals, budgets and rate limits are in-memory per process; SAM 3.1 is not implemented; no Facebook/Instagram publishing or ad spend is connected.

## How Muse Code and Anti were used
Development used two AI tools, and the evidence for each differs:
- **Muse Code CLI** (active model `muse-spark-1.3-contributor` in `ralion-meta-os-dev`): created the website-ingestion, DNS-pinned transport, v2 tenant auth, shared inference guard, live MARI diagnosis wiring with fallback, 8-workspace OS redesign, Phase 3 creative generation, isolated asset storage, social channel copy generation, human approval gateway, and the four post-extraction improvements (canonical social handoffs, creative format selection, tenant usage telemetry, learning-loop inspector) with their test suites. See [docs/MUSE_SLICE2_EVIDENCE.md](docs/MUSE_SLICE2_EVIDENCE.md), [docs/MUSE_SLICE3_EVIDENCE.md](docs/MUSE_SLICE3_EVIDENCE.md), and [docs/MUSE_POST_EXTRACTION_EVIDENCE.md](docs/MUSE_POST_EXTRACTION_EVIDENCE.md).
- **Anti** (IDE agent): created the budget ledger, approval module, live-probe harness, integrated and independently verified Muse's Slice 1, Slice 2, Slice 3, and Post-Extraction contributions, built Next.js production bundles, executed full Chrome browser acceptance tests via CDP, and maintained authoritative documentation and git commits.

Details, timestamps and limits: [docs/MUSE_CODE_DEVELOPMENT.md](docs/MUSE_CODE_DEVELOPMENT.md), [docs/MUSE_SLICE2_EVIDENCE.md](docs/MUSE_SLICE2_EVIDENCE.md), [docs/MUSE_SLICE3_EVIDENCE.md](docs/MUSE_SLICE3_EVIDENCE.md), and [docs/MUSE_POST_EXTRACTION_EVIDENCE.md](docs/MUSE_POST_EXTRACTION_EVIDENCE.md). Meta API receipts and security controls: [docs/AI_DEVELOPMENT_EVIDENCE.md](docs/AI_DEVELOPMENT_EVIDENCE.md).

## Source provenance
Read-only source: `rasali535/alinew` (`main`, inspected 2026-10-27). Curated, type-only contracts reside in `src/contracts`. No production database, service credentials, customer records, payment or billing services are copied. See `SOURCE_INVENTORY.md`.

## Safety boundaries
- Never connect this application to production Ralion infrastructure.
- Never commit `.env` files, private keys, access tokens or customer data. Meta credentials stay server-side.
- Demo data must be synthetic or permissioned.
- Require approval before any external publishing or spending. Approvals strictly enforce `LOCAL_DRAFT_ONLY`.
- Changes to this repository do not modify `alinew`.
- Website fetch uses DNS-pinned HTTPS transport per hop to prevent DNS rebinding attacks (`apps/meta-os/lib/website.js`).
- Media fetch from provider URLs uses pinned DNS, 8MB streaming caps, and binary magic-byte sniffing (`apps/meta-os/lib/website.js`).

## Tests
Requires Node.js 20 or newer. No billable API calls run in tests.

```bash
npm test                         # 9 root tests
npm --prefix apps/meta-os test   # 148 Meta OS tests (157 total)
```

## Run the apps locally
```bash
# Root prototype (loopback only, in-memory, no auth)
npm start        # http://127.0.0.1:3000

# Next.js Meta OS app
cd apps/meta-os && npm install && npm run dev   # http://localhost:3600
```

The root prototype's `meta` mode uses a chat-completions-style adapter that has **not** been validated against the Meta account; the Next.js app's Responses-API provider is the validated path. **Do not deploy the root prototype publicly.** See `docs/SECURITY.md`.

## Documentation
- [docs/AI_DEVELOPMENT_EVIDENCE.md](docs/AI_DEVELOPMENT_EVIDENCE.md)
- [docs/MUSE_CODE_DEVELOPMENT.md](docs/MUSE_CODE_DEVELOPMENT.md)
- [docs/MUSE_SLICE2_EVIDENCE.md](docs/MUSE_SLICE2_EVIDENCE.md)
- [docs/MUSE_SLICE3_EVIDENCE.md](docs/MUSE_SLICE3_EVIDENCE.md)
- [docs/MUSE_POST_EXTRACTION_EVIDENCE.md](docs/MUSE_POST_EXTRACTION_EVIDENCE.md)
- [docs/PHASE_1_5_VALIDATION_STATUS.md](docs/PHASE_1_5_VALIDATION_STATUS.md)
- [docs/RALION_REINTEGRATION_ARCHITECTURE.md](docs/RALION_REINTEGRATION_ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)

