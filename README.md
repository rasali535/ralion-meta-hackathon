# MARI Growth Autopilot — Meta Hackathon 2026

Standalone, public submission worktree. This is **not** a mirror of production Ralion OS.

[![Tests](https://img.shields.io/badge/tests-87%20passing-brightgreen.svg)](#tests)
[![Meta models](https://img.shields.io/badge/Meta%20models-owner--reported%20live%20receipts-blue.svg)](docs/AI_DEVELOPMENT_EVIDENCE.md)
[![Muse Code](https://img.shields.io/badge/Muse%20Code-session%20log%20evidence-lightgrey.svg)](docs/MUSE_CODE_DEVELOPMENT.md)

## Scope
Business context → Meta-powered reasoning → evidence-backed growth action proposal → human approval → isolated action execution → measured outcome.

## Current status (honest summary)
- **Working and tested offline (87 tests):** DNS-pinned website transport (re-pinned every redirect hop to prevent TOCTOU DNS rebinding), mission planning with grounded evidence labels, v2 tenant-scoped tokens (`v2.<org>.<workspace>.<exp>.<sig>`), shared inference access guard with per-token rate limits and per-workspace daily inference budgets, signed human-approval records strictly locked to `LOCAL_DRAFT_ONLY` with `execution: NOT_CONNECTED`, responsive 8-workspace OS shell (Command Center, Business, MARI, Growth, Creative, Social, Activity, Settings) with dark/light theme switching, and Meta provider adapters (Spark, Wonder, Muse Image).
- **Live Meta API receipts (reported by the project owner, not independently reproduced by the repo's automated tests):** Spark `resp_6ae0ff1b9215a46fe33a464a` (4,710 ms); Wonder `resp_6ae1034770c8117dac244a61` (6,081 ms); Muse Image 9,233 ms, image retrieved with HTTP 200 (`image/webp`, 298,186 bytes), request ID unavailable.
- **Live MARI integration:** Optional live MARI mission diagnosis (Spark/Wonder) behind explicit feature flags (`MARI_LIVE_REASONING_ENABLED=true` and master switch `META_REASONING_API_ENABLED=true`) plus demo token authentication, with automatic deterministic fallback if credentials or flags are absent or if inference fails.
- **Safety boundaries enforced:** Public demo mission flow defaults to deterministic demo without calling billable Meta models; the direct inference route is disabled by default; human approval records can never trigger live ad execution; approvals, budgets and rate limits are in-memory per process; SAM 3.1 is not implemented; no Facebook/Instagram publishing or ad spend is connected.

## How Muse Code and Anti were used
Development used two AI tools, and the evidence for each differs:
- **Muse Code CLI** (active model `muse-spark-1.3-contributor` in `ralion-meta-os-dev`): created the website-ingestion, DNS-pinned transport, v2 tenant auth, shared inference guard, live MARI diagnosis wiring with fallback, draft approval attachment, 8-workspace OS redesign, and their tests. See [docs/MUSE_SLICE2_EVIDENCE.md](docs/MUSE_SLICE2_EVIDENCE.md).
- **Anti** (IDE agent): created the budget ledger, approval module, live-probe harness, integrated and independently verified Muse's Slice 1 and Slice 2 contributions, built Next.js production bundles, executed smoke verification, and maintained authoritative documentation and git commits.

Details, timestamps and limits: [docs/MUSE_CODE_DEVELOPMENT.md](docs/MUSE_CODE_DEVELOPMENT.md) and [docs/MUSE_SLICE2_EVIDENCE.md](docs/MUSE_SLICE2_EVIDENCE.md). Meta API receipts and security controls: [docs/AI_DEVELOPMENT_EVIDENCE.md](docs/AI_DEVELOPMENT_EVIDENCE.md).

## Source provenance
Read-only source: `rasali535/alinew` (`main`, inspected 2026-10-27). Curated, type-only contracts reside in `src/contracts`. No production database, service credentials, customer records, payment or billing services are copied. See `SOURCE_INVENTORY.md`.

## Safety boundaries
- Never connect this application to production Ralion infrastructure.
- Never commit `.env` files, private keys, access tokens or customer data. Meta credentials stay server-side.
- Demo data must be synthetic or permissioned.
- Require approval before any external publishing or spending. Approvals strictly enforce `LOCAL_DRAFT_ONLY`.
- Changes to this repository do not modify `alinew`.
- Website fetch uses DNS-pinned HTTPS transport per hop to prevent DNS rebinding attacks (`apps/meta-os/lib/website.js`).

## Tests
Requires Node.js 20 or newer. No billable API calls run in tests.

```bash
npm test                         # 9 root tests
npm --prefix apps/meta-os test   # 78 Meta OS tests (87 total)
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
- [docs/PHASE_1_5_VALIDATION_STATUS.md](docs/PHASE_1_5_VALIDATION_STATUS.md)
- [docs/RALION_REINTEGRATION_ARCHITECTURE.md](docs/RALION_REINTEGRATION_ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)

