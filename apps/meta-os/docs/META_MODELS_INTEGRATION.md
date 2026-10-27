# Meta AI implementation matrix — Ralion OS Meta AI Edition

Verified from Meta documentation (2026-10-27):
- https://dev.meta.ai/docs/overview
- https://dev.meta.ai/docs/models
- https://dev.meta.ai/docs/image-generation
- https://dev.meta.ai/docs/media-segmentation

## Implemented adapters (server-side)
1. **Muse Spark 1.3**: `reasonWithMeta({mode:'spark'})` via `POST https://api.meta.ai/v1/responses`. Only supplied facts; no fabricated website crawl, campaign metrics or publishing.
2. **Muse Wonder 1.0**: `reasonWithMeta({mode:'wonder'})` through the same provider port for complex reasoning.
3. **Muse Image 1.0**: `generateWithMuseImage` via `POST /v1/images/generations`, returning a temporary signed URL or base64. Must save a verified media asset to isolated storage before later use.
4. **Meta status API**: `GET /api/meta/status` returns model readiness without exposing secrets. `POST /api/meta/reason` is guarded and disabled by default.

## Pending real integration
- **SAM 3.1**: hosted via `POST /v1/responses` for text-prompted image/video segmentation. Implement verified media payload and masks parser against official samples before enabling. Reserve it for product cutouts, visual inspection and asset preparation; it does *not* measure marketing effectiveness.
- **Muse Spark Open**: self-hosted/hosted third-party inference adapter (not a Meta Model API model). Requires separate dedicated inference compute and endpoint, license/security review and explicit costs. No deployment has been provisioned.
- **Muse Code**: developer CLI, **not** a MARI runtime. On Windows PowerShell, Meta currently documents `irm https://dev.meta.ai/install.ps1 | iex`; on macOS/Linux `curl -fsSL https://dev.meta.ai/install.sh | sh`. Review downloaded scripts before executing; authenticate through Meta's supported sign-in. Do not commit keys or bind Muse Code to production `alinew`.
- **Real inference** is not yet tested because this environment has no project Model API key provisioned.
- **Live public app** remains a deterministic demo. No frontend calls to paid inference exist yet, intentionally.

## Credential provisioning
At https://dev.meta.ai, create a Model API key for the appropriate hackathon project and configure these **only in the new isolated preview Vercel project**, never in public GitHub, the browser, or production Ralion:
- `MODEL_API_KEY` = server-only Model API credential.
- `META_REASONING_API_ENABLED=false` until authentication, quotas and rate limits are in place.
- `META_REASONING_ACCESS_TOKEN` = separate high-entropy server-side access token for restricted integration testing.
No real secret belongs in `.env.example`.

## Reintegration
Provider is an explicit adapter under `lib/meta/provider.js`. Move its interface/contract tests into a portable `packages/ai` provider package before integrating into Ralion, then connect workspace-scoped business context, feature flags, approvals, audit logs and cost accounting.

## Acceptance criteria
- Real Muse Spark and Wonder credentials pass provider tests on isolated staging.
- Grounded responses are attributable to the correct model and capture request IDs.
- Muse Image output actually exists and is persisted, then reviewed; no phantom media assets.
- SAM produces masks on permissioned test media and output geometry is validated.
- A stable fallback exists when Meta inference fails; fallback is **clearly labeled** non-Meta demo.
- All external actions require server-verified, scoped human approval.
