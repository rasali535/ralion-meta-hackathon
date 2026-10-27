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

## 4. Security controls and what they do not cover

Implemented and unit-tested:

- Website ingestion: HTTPS only, host/IP blocklists, DNS check per hop, redirect limit of 3, 750,000-byte cap, timeout. Known residual risk: DNS rebinding between check and connect (documented in `website.js`).
- Access tokens: static token or HMAC workspace token with expiry, timing-safe comparison.
- Rate limiting: in-memory token buckets (10/min burst, 200/day per token). This is per server instance and only approximate on serverless deployments.
- Workspace inference budget (`lib/budget.js`): in-memory per-workspace daily counters. Not durable across restarts or instances.
- Human approval records (`lib/approval.js`): HMAC-signed, bound to a hash of the mission plan, scope limited to `LOCAL_DRAFT_ONLY`. **This module is not yet wired into any route or UI.** Approvals are not persisted.
- Organization isolation is not enforced end to end. `approval.js` requires an organization and workspace identifier, but the inference route only derives a workspace from the token.

Production isolation: no production Ralion OS code, database, Stripe, Meta ad account or customer data is used in this repository. Source repository `alinew` was read only.

## 5. Tests

55 passing tests (9 root, 46 in `apps/meta-os`), run offline with `node --test`. No billable calls occur in the test suite.

```bash
npm test
npm --prefix apps/meta-os test
```

| File | Tests |
| :--- | :--- |
| `tests/businessIntake.test.js` | 3 |
| `tests/campaignPlan.test.js` | 2 |
| `tests/engine.test.js` | 4 |
| `apps/meta-os/tests/meta-provider.test.mjs` | 6 |
| `apps/meta-os/tests/website-ingest.test.mjs` | 13 |
| `apps/meta-os/tests/mission-evidence.test.mjs` | 5 |
| `apps/meta-os/tests/auth.test.mjs` | 6 |
| `apps/meta-os/tests/ratelimit.test.mjs` | 5 |
| `apps/meta-os/tests/budget.test.mjs` | 4 |
| `apps/meta-os/tests/approval.test.mjs` | 4 |
| `apps/meta-os/tests/live-probes.test.mjs` | 3 |

Authorship of individual test files is in [MUSE_CODE_DEVELOPMENT.md](MUSE_CODE_DEVELOPMENT.md), section 4 and 5. `npm run build` for the Next.js app was not run in this environment (dependencies not installed locally); CI builds it.

## 6. Verification steps for judges

1. Clone the repo and run the two test commands above.
2. `cd apps/meta-os && npm install && npm run dev`, open `http://localhost:3600`. The mission flow is a deterministic demo with website evidence; it is not a Meta model call.
3. Ask the team to show the Muse Code session logs and the owner's live probe output. These are not in Git.
