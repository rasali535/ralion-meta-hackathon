# MARI Growth Autopilot — Meta Hackathon 2026

Standalone, public submission worktree. This is **not** a mirror of production Ralion OS.

## Scope
Business context → Meta-powered reasoning → evidence-backed growth action proposal → human approval → isolated action execution → measured outcome. No claim of live Meta integration until implemented and tested.

## Source provenance
Read-only source: `rasali535/alinew` (`main`, inspected 2026-10-27). Curated, type-only source contracts reside in `src/contracts`. No production database, service credentials, customer records, authentication wiring, payment or billing services are copied.

## Safety boundaries
- Never connect this application to production Ralion infrastructure.
- Never commit .env files, private keys, access tokens or customer data.
- Demo data must be synthetic or permissioned.
- Require approval before any external publishing or spending.
- Changes to this repository do not modify `alinew`.

## Current status
Initial repository bootstrap and safe reusable contract extraction only. App runtime, Meta API adapter, tests, demo and deployment are **not yet implemented**.

See `SOURCE_INVENTORY.md` for provenance, inclusions, exclusions and next steps.

## Run the prototype locally

Requires Node.js 20 or newer. This stage has no third-party runtime dependencies.

```bash
npm run check
npm test
npm start
```

Open `http://127.0.0.1:3000`. The demo-mode growth recommendation and approval/draft flow work with synthetic input and no API credentials. **Demo mode does not invoke Meta AI.**

To exercise a supported Meta model endpoint, configure `META_MODEL_API_URL`, `META_MODEL_API_KEY` and `META_MODEL_ID` in your local environment (see `.env.example`). The adapter currently expects a compatible HTTPS chat-completions response with `choices[0].message.content` as JSON. This compatibility has not been validated against our hackathon account.

A GitHub Actions check has been added; CI status should be confirmed in the Actions tab. The environment used to author this commit could not retrieve the public repository for a local test run, so no passing-test claim is made.

**Do not deploy this prototype publicly yet.** Its server binds to loopback, uses in-memory storage and has no authentication. See `docs/SECURITY.md` for productionization controls.
