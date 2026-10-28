# Meta AI Development Evidence

This document separates (a) how Meta's developer tool was used to build the project from (b) how Meta models run inside the application, and states the evidence level of each claim.

> **Corrected 2026-10-27.** Earlier text overstated Muse Code authorship and live-validation evidence. See [MUSE_CODE_DEVELOPMENT.md](MUSE_CODE_DEVELOPMENT.md) for the evidence trail.

## 1. Summary

| Layer | Technology | Evidence level |
| :--- | :--- | :--- |
| Development tool | Muse Code CLI, active model `muse-spark-1.3-contributor` | Local session logs show 88 tool calls and 10 file creations in this repository. Logs are not published in Git. |
| Runtime reasoning (fast) | `muse-spark-1.3` via `POST /v1/responses` | Owner-supplied live receipt |
| Runtime reasoning (deep) | `muse-wonder-1.0` via `POST /v1/responses` | Owner-supplied live receipt |
| Runtime image generation | `muse-image-1.0` via `POST /v1/images/generations` | Owner-supplied live receipt |
| Segmentation | `sam-3.1` | Not implemented. Constant and documentation only. |

## 2. Muse Code in development

- The active Muse session model is `muse-spark-1.3-contributor`. The `muse-wonder.example.toml` file in the repo is an example configuration, not the running session's model.
- Muse's session log records it creating the website-ingestion module, the mission-evidence changes and the access-token and rate-limit modules, together with their tests, and running those tests.
- Anti (a separate IDE agent) created the budget ledger, the human-approval module, the live-probe harness and their tests, synchronized files into this worktree and made the commits.
- Git author names do not distinguish the two tools. Muse's contribution rests on its session log.
- Full file list, timestamps and limits: [MUSE_CODE_DEVELOPMENT.md](MUSE_CODE_DEVELOPMENT.md).

## 3. Live Meta API receipts

These receipts were **supplied by the project owner** from live probe runs. They were **not independently witnessed by Anti**. Anti's own runs of the probe harness were dry runs against fake transports.

| Model | Request ID | Latency | Other |
| :--- | :--- | :--- | :--- |
| `muse-spark-1.3` | `resp_6ae0ff1b9215a46fe33a464a` | 4,710 ms | Contextual response received |
| `muse-wonder-1.0` | `resp_6ae1034770c8117dac244a61` | 6,081 ms | Responses API call |
| `muse-image-1.0` | unavailable | 9,233 ms | Image URL returned: yes. Asset retrieval HTTP 200, `image/webp`, 298,186 bytes. Asset verified: yes |

Signed media URLs and credentials are deliberately not recorded. The Muse Image response did not provide a request ID.

How the models are used in the application code:

- `reasonWithMeta({mode:'spark'|'wonder'})` in `apps/meta-os/lib/meta/provider.js` calls the Responses API from the server only. Wonder uses `reasoning: {effort:'high', summary:'auto'}`.
- `generateWithMuseImage` calls the image endpoint from the server only and always returns `reviewRequired: true`. The probe harness checks the returned URL with an HTTP request before reporting `assetVerified`.
- The paid-inference route `POST /api/meta/reason` is **disabled by default** (`META_REASONING_API_ENABLED` must be `true`). The mission route in the public demo is deterministic and does not call Meta models.

## 4. Security controls and verification audit

All 14 security controls required for production readiness and safe hackathon operation have been independently verified:

| # | Control | Implementation | Verification Status |
| :- | :--- | :--- | :--- |
| 1 | Explicit user authorization | `confirm: true` asserted in `creative.js` and `#gen-confirm` checkbox guard in UI | **VERIFIED** |
| 2 | Tenant authentication & workspace isolation | `checkInferenceAccess` and v2 HMAC token validation in `auth.js` | **VERIFIED** |
| 3 | No caller-controlled storage paths | Strict segment regex and `bin.startsWith(base + sep)` boundary assertions in `creative-store.js` | **VERIFIED** |
| 4 | Safe media retrieval | Pinned DNS streaming via `website.js` (`fetchPinnedMedia`), redirect limits, zero shell calls | **VERIFIED** |
| 5 | SSRF & private network prevention | IP literal blocklists, loopback/private range blocking, port 443 HTTPS only | **VERIFIED** |
| 6 | Content-type & size enforcement | Binary magic-byte sniffing (`sniffImageType`) for PNG/JPEG/WEBP/GIF and 8MB streaming cap | **VERIFIED** |
| 7 | Signed preview URL capability expiry | Expiring (15m default, 2h max) HMAC signatures validated with `timingSafeEqual` in `asset-url.js` | **VERIFIED** |
| 8 | Cross-tenant asset access denied | Signed capability binds tenant org/workspace; cross-tenant requests rejected | **VERIFIED** |
| 9 | Approval binds exact draft & creative | `hashMissionPlan` hashes creative prompts, byte counts, sha256 sums, and social channel copy | **VERIFIED** |
| 10 | Content edit invalidates approval | Any variation in plan components produces a hash mismatch; signature check fails immediately | **VERIFIED** |
| 11 | No external execution or publishing | Scope strictly forced to `LOCAL_DRAFT_ONLY` with `execution: NOT_CONNECTED` in `attachApproval` | **VERIFIED** |
| 12 | Atomic budget reservation | Synchronous ledger reservation in process memory under concurrent requests in `budget.js` | **VERIFIED** |
| 13 | Failed call reservation release | `settleInferenceUsage(receipt, { ok: false })` rolls back reserved units on failure | **VERIFIED** |
| 14 | Unauthenticated route denial | Direct paid routes (`reason`, `approve`, `generate`, `assets`) deny unauthenticated requests | **VERIFIED** |
| 15 | Canonical Social Handoff Contract packaging | Channel drafts packaged into `SocialHandoffContract` with `DRAFT_ONLY` and `NOT_CONNECTED` bound to approval hash | **VERIFIED** |
| 16 | Requested format metadata correctness | Format controls (1:1, 4:5, 9:16) labeled strictly as requested without claiming guaranteed pixel output | **VERIFIED** |
| 17 | Tenant-scoped AI usage telemetry | Bounded buffer keyed strictly by authenticated tenant `(org, ws)`; no prompts, tokens, or costs logged | **VERIFIED** |
| 18 | Read-only learning loop inspector | Seven-stage mission derivation with mandatory `Publish NOT CONNECTED` and `Performance NOT AVAILABLE` badges | **VERIFIED** |

*Note on Local Storage & Process Memory:* Current budget, token buckets, and asset storage reside in local process memory and file paths (`.data/creative/`). A distributed deployment would require Redis/PostgreSQL backing before scaling past single-node.

Production isolation: no production Ralion OS code, database, Stripe, Meta ad account or customer data is used in this repository. Source repository `alinew` was read only.

## 5. Tests

157 passing tests (9 root, 148 in `apps/meta-os`), run offline with `node --test`. No billable calls occur in the test suite.

```bash
npm test
npm --prefix apps/meta-os test
```

| File | Tests |
| :--- | :--- |
| `tests/businessIntake.test.js` | 3 |
| `tests/campaignPlan.test.js` | 2 |
| `tests/engine.test.js` | 4 |
| `apps/meta-os/tests/approval-creative.test.mjs` | 2 |
| `apps/meta-os/tests/approval.test.mjs` | 4 |
| `apps/meta-os/tests/asset-url.test.mjs` | 4 |
| `apps/meta-os/tests/auth.test.mjs` | 7 |
| `apps/meta-os/tests/budget-reserve.test.mjs` | 4 |
| `apps/meta-os/tests/budget.test.mjs` | 4 |
| `apps/meta-os/tests/creative-format.test.mjs` | 7 |
| `apps/meta-os/tests/creative-store.test.mjs` | 6 |
| `apps/meta-os/tests/creative.test.mjs` | 5 |
| `apps/meta-os/tests/image-prompt.test.mjs` | 4 |
| `apps/meta-os/tests/inference-access.test.mjs` | 7 |
| `apps/meta-os/tests/inference-reserve.test.mjs` | 3 |
| `apps/meta-os/tests/learning-loop.test.mjs` | 6 |
| `apps/meta-os/tests/live-probes.test.mjs` | 3 |
| `apps/meta-os/tests/mari.test.mjs` | 6 |
| `apps/meta-os/tests/media-fetch.test.mjs` | 5 |
| `apps/meta-os/tests/meta-provider.test.mjs` | 6 |
| `apps/meta-os/tests/mission-approval.test.mjs` | 5 |
| `apps/meta-os/tests/mission-approve.test.mjs` | 4 |
| `apps/meta-os/tests/mission-evidence.test.mjs` | 5 |
| `apps/meta-os/tests/navigation.test.mjs` | 5 |
| `apps/meta-os/tests/pinned-transport.test.mjs` | 8 |
| `apps/meta-os/tests/ratelimit.test.mjs` | 5 |
| `apps/meta-os/tests/social-copy.test.mjs` | 4 |
| `apps/meta-os/tests/social-handoff.test.mjs` | 9 |
| `apps/meta-os/tests/telemetry.test.mjs` | 7 |
| `apps/meta-os/tests/website-ingest.test.mjs` | 13 |

Authorship of test files is documented in [MUSE_CODE_DEVELOPMENT.md](MUSE_CODE_DEVELOPMENT.md), [MUSE_SLICE2_EVIDENCE.md](MUSE_SLICE2_EVIDENCE.md), [MUSE_SLICE3_EVIDENCE.md](MUSE_SLICE3_EVIDENCE.md), and [MUSE_POST_EXTRACTION_EVIDENCE.md](MUSE_POST_EXTRACTION_EVIDENCE.md). Next.js production build (`npm run build`) compiles cleanly with zero lint or type errors (12 static pages generated).

## 6. Verification steps for judges

1. Clone the repo and run the two test commands above (157/157 passing).
2. `cd apps/meta-os && npm install && npm run build && npm run dev`, open `http://localhost:3600`. The mission flow is a deterministic demo with website evidence; creative generation uses mock offline bytes when keys are offline; it is not a billable Meta model call.
3. Run the automated real-browser acceptance test: `node scripts/browser-acceptance.mjs`. It drives headless Chrome through all 8 workspaces, tests theme toggling, mission submission, creative prompt composer with requested format controls (9:16 Story), unconfirmed generation rejection, authorized generation with signed capability URLs, social draft cards with canonical handoffs, human approval minting with approval hash binding, and activity workspace with usage telemetry and 7-stage learning loop inspector.
4. Ask the team to show the Muse Code session logs, Slice 2, Slice 3, and Post-Extraction evidence docs, and the owner's live probe output. These are not in Git.

