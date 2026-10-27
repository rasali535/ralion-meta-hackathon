# Ralion OS — Meta AI Edition (isolated Next.js foundation)

This app is a **separate Next.js implementation** inspired by the existing Ralion OS application layout and module boundaries in `rasali535/alinew`. The upstream repository was inspected read-only.

## Run locally
```bash
cd apps/meta-os
npm install
npm run dev
# http://localhost:3600
```

## Included
- Unified OS shell: Workspace, Business, MARI AI, Growth, Creative, Social, Activity.
- Business intake including URL reference, objective, audience and first-party facts.
- `POST /api/mission` outputs a structured Growth → Creative → Social **draft** with human approval and measurement statuses.
- Deterministic demo provider; strict evidence labels and no fake conversion data or invented successful campaign actions.
- No public secrets, customer assets, production database, social publishing integration, or hardcoded tenant identifiers.

## Not implemented
- Production-validated authentication/multi-tenancy, persisted mission state and secure approvals.
- Website fetching, brand extraction or multimodal media analysis.
- Meta model inference, creative asset generation, campaign publishing, Meta Graph API metrics.
- The above must be built and tested before the product is represented as a complete autonomous Meta-powered OS.

## Isolation and promotion gate
- This application resides on `feat/meta-ai-os-foundation`; `main` and production Vercel routing remain unchanged.
- Build/functional tests run in `.github/workflows/meta-os.yml`.
- Create a separate Vercel preview with root `apps/meta-os` **only after** CI passes.
- To replace the existing live hackathon demo later, choose and verify a dedicated Vercel configuration; do not change unrelated projects.
- `rasali535/alinew` is a **read-only reference**, never a deployment target or source of private tenant data.

## Reintegration
- Keep portable mission schemas, provider ports, authorizations, evidence provenance and audit receipts independent of Next.js.
- When features are proven, introduce them into production Ralion OS via reviewed PRs behind per-workspace feature flags; run in no-action shadow mode first.
