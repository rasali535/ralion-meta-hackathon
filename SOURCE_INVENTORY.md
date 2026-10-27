# Public-source extraction inventory — 2026-10-27

Source repository: `rasali535/alinew`, read **only** via GitHub.
Destination repository: `rasali535/ralion-meta-hackathon` (public).

## Copied as-is after text inspection and pattern scan
- `packages/ai/src/creativeBrief.types.ts` → `src/contracts/creativeBrief.types.ts` (5589 characters): standalone type/interface contract. No detected private keys, key-like values, email addresses or hardcoded UUIDs.
- `packages/ai/src/creativeProvider.interface.ts` → `src/contracts/creativeProvider.interface.ts` (2487 characters): standalone type/interface contract. No detected private keys, key-like values, email addresses or hardcoded UUIDs.

## Explicitly NOT copied
- Production business-identity resolver (contains hardcoded live tenant identifiers and tenant-specific rules).
- Business profile and context services: coupled to production identity/context and runtime dependencies.
- MARI orchestrator, chat, API routes, social connectors and creative providers: need dependency closure, credential/configuration review and adapted storage/authorization boundaries before public export.
- Customer data, migrations, database dumps, binaries, creative uploads, generated builds and complete Git history.

## Required next engineering tasks
1. Design a clean standalone TypeScript app shell and Meta model adapter.
2. Extract only necessary business-context interfaces or rewrite explicitly clean domain contracts.
3. Implement an approval-gated action ledger with synthetic demonstration data.
4. Add CI secret detection, unit tests, packaging/build and end-to-end demo.
5. Verify public-repository licensing/attribution before a wider source release.

Pattern scans are not exhaustive. New code must be reviewed independently before each public commit.
