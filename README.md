# MARI Growth Autopilot — Meta Hackathon 2026

Standalone, public submission worktree. This is **not** a mirror of production Ralion OS.

[![Tests](https://img.shields.io/badge/tests-229%20passing-brightgreen.svg)](#tests)
[![Meta models](https://img.shields.io/badge/Meta%20models-live%20verified%20receipts-blue.svg)](docs/AI_DEVELOPMENT_EVIDENCE.md)
[![Muse Code](https://img.shields.io/badge/Muse%20Code-session%20log%20evidence-lightgrey.svg)](docs/MUSE_CODE_DEVELOPMENT.md)

## Scope
Business context → Meta-powered reasoning → evidence-backed growth action proposal → multimedia creative synthesis (image, playable 9:16 video reel, and voiceover workflow) → human approval → isolated action execution → measured outcome.

## Current status (honest summary)
- **Working and tested offline (229 tests: 9 root + 220 Meta OS):**
  - **Multimedia Campaign Reel & Voice Workflow:**
    - Single business instruction with voice dictation (`SpeechRecognition` + one-click spoken preset fallback) and MARI spoken audio briefing (`speechSynthesis`) in the Command Centre (`apps/meta-os/app/views/command.jsx`).
    - 3-scene 9:16 campaign reel storyboard & commercial voiceover generator (`apps/meta-os/lib/multimedia.js`), producing tenant-isolated ISO-BMFF MP4 container assets (`video/mp4`) and 16-bit PCM WAV voiceover narration tracks (`audio/wav`), plus an interactive HTML5 Canvas / `MediaRecorder` playable video reel player in Creative Studio (`apps/meta-os/app/views/creative.jsx`) and Social review (`apps/meta-os/app/views/social.jsx`).
  - **Business Memory & Review Lessons:**
    - Append-only decision memory (`apps/meta-os/lib/memory.js`) isolated per tenant workspace (`.data/memory/<org>/<ws>/`), capturing mission ID, plan hash, decision, actor, and before/after draft edit deltas.
    - Honest lesson derivation strictly from review outcomes: untouched approval patterns, custom copy refinements, and declined concepts.
    - Strict invariant: every business lesson must cite its source decisions (mission IDs + timestamps); a lesson with no cited decisions cannot exist.
    - Activity workspace review memory panel with cited sources, recency, and explicit disclaimer that lessons reflect workspace human reviews, not ad performance or market analytics.
    - Memory-aware draft shaping (`apps/meta-os/lib/social-copy.js`) with explicit label `"Shaped by N approved draft(s) in this workspace"`.
  - **Flagship MARI Command Centre:** Full hero goal submission (`apps/meta-os/app/views/command.jsx`), 4 state-driven KPI cards, 7-state workflow tracker, recent activity timeline, 6 gated quick actions with prerequisite banners, and seamless handoff into MARI mission planning.
  - **Phase 1-2 Foundation:** DNS-pinned website transport (re-pinned every redirect hop to prevent TOCTOU DNS rebinding), mission planning with grounded evidence labels, v2 tenant-scoped tokens (`v2.<org>.<workspace>.<exp>.<sig>`), shared inference access guard with per-token rate limits and per-workspace daily inference budgets, signed human-approval records strictly locked to `LOCAL_DRAFT_ONLY` with `execution: NOT_CONNECTED`, responsive 8-workspace OS shell (Command Center, Business, MARI, Growth, Creative, Social, Activity, Settings) with dark/light theme switching, and Meta provider adapters (Spark, Wonder, Muse Image).
  - **Phase 3 Creative Studio & Social Gateway:** Guided brief selection (Growth, MARI, or Custom), editable prompt composer, explicit confirmation checkbox guard, server-side tenant-isolated binary asset storage (`.data/creative/`), magic byte type verification (`image/png`, `image/jpeg`, `image/webp`, `image/gif`), expiring HMAC-signed capability preview URLs (`GET /api/creative/asset?id=...&org=...&ws=...&exp=...&sig=...`), multi-channel draft generator (Facebook, Instagram) with grounded evidence chips and mandatory `NOT PUBLISHED · PUBLISHING NOT APPROVED` guard chips, thumbnail preview row, cryptographic human approval minting (`POST /api/mission/approve`), and exact plan hash binding that invalidates approvals upon draft modification.
  - **Post-Extraction & Premium Integration:**
    1. *Canonical `SocialHandoffContract` packaging:* per-channel contract (`apps/meta-os/lib/social-handoff.js`) linking tenant, mission, primary asset, preview pointer, draft copy, `DRAFT_ONLY` + `NOT_CONNECTED`, bound to cryptographic approval.
    2. *Creative Studio requested-format controls:* format selection (1:1 Square, 4:5 Portrait, 9:16 Story) in `apps/meta-os/lib/creative-format.js` and `views/creative.jsx`, framing built prompts while keeping user prompts verbatim, asset metadata badge `Requested <format>` (without false claims of guaranteed pixel dimensions).
    3. *Tenant-scoped AI usage telemetry:* bounded in-memory buffer (`apps/meta-os/lib/telemetry.js`) and endpoint `GET /api/telemetry/usage` recording verified call facts (model, provider, requestId, tenant, latency, ok/fail, budget outcome) without fabricating tokens or logging sensitive data.
    4. *Read-only learning-loop inspector:* 7-stage inspector (`apps/meta-os/lib/learning-loop.js`) displayed on `ActivityView` (`apps/meta-os/app/views/activity.jsx`) with honesty badges `Publish NOT CONNECTED` and `Performance NOT AVAILABLE`.
  - **Judge Demo Session Authentication & UX:**
    - Canonical endpoint `/api/session/demo` (with `/api/demo/session` consolidated and delegated) issuing short-lived, tenant-scoped sessions stored in `Secure`, `HttpOnly`, `SameSite=Lax` cookies (`ralion_demo_session`).
    - Issuance abuse rate limiting (5 mints/hr/IP) and pinned strictly to `demo` tenant to prevent arbitrary organization impersonation.
    - Zero HMAC signing secrets or paid credentials exposed to client bundles.
    - Active session lifecycle controls in Settings and Topbar with instant server-side revocation.
    - Deterministic mode fully usable without manually entering or pasting any token.
    - Vercel serverless read-only filesystem constraints documented in [docs/VERCEL_STORAGE_LIMITATIONS.md](docs/VERCEL_STORAGE_LIMITATIONS.md) with `/tmp` ephemeral fallback.
- **Sandbox Dispatch Outbox:** Approved-only export of exact approved bytes (asset manifest plus channel copy) into signed, tenant-isolated receipts via POST /api/dispatch, idempotent per approval with plan-hash tamper rejection; receipts surface in Activity with SANDBOX EXPORT ONLY and NOT PUBLISHED badges, and the learning loop reports approval-to-export latency while publication stays NOT CONNECTED.
- **Modal Sandbox Execution:** When MODAL_DISPATCH_URL is configured, dispatch runs the exact bundle bytes through an isolated Modal sandbox (modal/dispatch_executor.py) that re-verifies the bundle hash and packages a checks report; the returned execution id is bound into the receipt signature as independent compute evidence, with graceful fallback to the plain receipt when Modal is unreachable.
- **Tenant Brand Kit:** Business knowledge MARI writes with (tagline, voice tone, hashtags, CTA style, brand colors) set in the Business workspace, sanitized server-side, and consumed by channel drafts with an explicit on-brand grounding label.
- **Mock Social Previews:** Simulated Facebook and Instagram post layouts for every draft with brand styling, SIMULATED PREVIEW plus NOT PUBLISHED badges, and zero engagement metrics — layout only, never publishing.
- **One-Click Live MARI Mode:** Settings card showing live prerequisites (server key, both inference flags, session, per-mode budgets) with a single toggle and model picker; a read-only server probe reports readiness without consuming rate limits or budget, and requesting live without prerequisites shows exactly what is missing while missions keep their deterministic fallback.
- **Live Meta API receipts & Probe Harness:**
  - Independently verified live probe receipts (`apps/meta-os/scripts/live-probes.mjs`): Spark `resp_6ae8730642c0a5864fb24bf7` (7,422 ms) and `resp_6ae0ff1b9215a46fe33a464a` (4,710 ms); Wonder `resp_6ae87310a8e4574fb5b34d01` (9,872 ms) and `resp_6ae1034770c8117dac244a61` (6,081 ms); Muse Image HTTP 200 (17,747 ms, `image/webp`, `313,364 bytes`, `assetVerified: true`).
  - Minimal live probe harness (`apps/meta-os/scripts/live-probes.mjs`) covers Spark (`probeMuseSpark`), Wonder (`probeMuseWonder`), and Image (`probeMuseImage`). Automated contract dry-runs pass 100% offline without egress; `--authorize-billable` safely aborts if `MODEL_API_KEY` is not present in the shell.
- **Live MARI integration:** Optional live MARI mission diagnosis (Spark/Wonder) behind explicit feature flags (`MARI_LIVE_REASONING_ENABLED=true` and master switch `META_REASONING_API_ENABLED=true`) plus demo token authentication, with automatic deterministic fallback if credentials or flags are absent or if inference fails.
- **Safety boundaries enforced:** Public demo mission flow defaults to deterministic demo without calling billable Meta models; the direct inference route is disabled by default; human approval records can never trigger live ad execution; approvals, budgets and rate limits are in-memory per process; SAM 3.1 is not implemented; no Facebook/Instagram publishing or ad spend is connected.

## How Muse Code and Anti were used
Development used two AI tools, and the evidence for each differs:
- **Muse Code CLI** (active model `muse-spark-1.3-contributor` in `ralion-meta-os-dev`): created the website-ingestion, DNS-pinned transport, v2 tenant auth, shared inference guard, live MARI diagnosis wiring with fallback, 8-workspace OS redesign, Phase 3 creative generation, isolated asset storage, social channel copy generation, human approval gateway, the four post-extraction improvements (canonical social handoffs, creative format selection, tenant usage telemetry, learning-loop inspector), and the flagship Command Centre UI overhaul with its test suites. See [docs/MUSE_SLICE2_EVIDENCE.md](docs/MUSE_SLICE2_EVIDENCE.md), [docs/MUSE_SLICE3_EVIDENCE.md](docs/MUSE_SLICE3_EVIDENCE.md), [docs/MUSE_POST_EXTRACTION_EVIDENCE.md](docs/MUSE_POST_EXTRACTION_EVIDENCE.md), and [docs/MUSE_PREMIUM_UI_EVIDENCE.md](docs/MUSE_PREMIUM_UI_EVIDENCE.md).
- **Anti** (IDE agent): created the budget ledger, approval module, live-probe harness, consolidated and reconciled the demo session authentication architecture (`/api/session/demo`), implemented the business memory and review lessons system (`apps/meta-os/lib/memory.js`), added the Spark probe (`probeMuseSpark`), integrated and independently verified Muse's Slice 1, Slice 2, Slice 3, Post-Extraction, and Premium UI contributions, built Next.js production bundles, executed full Chrome browser acceptance tests via CDP across all 8 workspaces, and maintained authoritative documentation and git commits.

Details, timestamps and limits: [docs/MUSE_CODE_DEVELOPMENT.md](docs/MUSE_CODE_DEVELOPMENT.md), [docs/MUSE_SLICE2_EVIDENCE.md](docs/MUSE_SLICE2_EVIDENCE.md), [docs/MUSE_SLICE3_EVIDENCE.md](docs/MUSE_SLICE3_EVIDENCE.md), [docs/MUSE_POST_EXTRACTION_EVIDENCE.md](docs/MUSE_POST_EXTRACTION_EVIDENCE.md), and [docs/MUSE_PREMIUM_UI_EVIDENCE.md](docs/MUSE_PREMIUM_UI_EVIDENCE.md). Meta API receipts and security controls: [docs/AI_DEVELOPMENT_EVIDENCE.md](docs/AI_DEVELOPMENT_EVIDENCE.md).

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
npm --prefix apps/meta-os test   # 220 Meta OS tests (229 total)
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

