# Reintegrating MARI Growth Intelligence into Ralion OS

## Product principle
The hackathon is an **isolated incubation environment**, not a fork to merge wholesale into production. Every reusable capability must be built as a portable, typed module with explicit inputs, outputs and injected dependencies.

## Architectural boundary
```
Hackathon UI / Demo routes         Ralion OS Growth / MARI / Social UI
           |                                      |
           +--------- Application adapter --------+
                              |
          @ralion/growth-intelligence-core (portable)
          - evidence models and provenance
          - opportunity diagnosis + priorities
          - campaign/creative plan contracts
          - agent workflow state machine
          - policy checks and authorization requirements
          - action commands, receipts, outcome measurements
                              |
                  Dependency ports (interfaces)
          WebsiteReader | ModelProvider | CreativeProvider
          CampaignPublisher | MetricsReader | WorkflowStore
          ApprovalAuthority | AuditSink | Clock
                  /                          \
           Demo adapters                 Ralion adapters
           Synthetic data,               Existing Supabase,
           isolated storage,             Mari, Growth, Social,
           sandbox publishers            Meta integrations
```

## Rules
1. **No imports from production web routes or dashboards in the core.** No hardcoded production URLs, workspace IDs, customer names, auth bypasses or environment secrets.
2. **No direct provider calls from UI or business decision code.** Meta model and multimodal providers implement versioned ports; selection/configuration is done in adapters. Model identifiers and prompt versions are captured in execution traces.
3. **Tenant-first contracts**: `organizationId`, `workspaceId`, optional `locationId`, actor identity and role authorization. The hackathon's public demo may use fixed synthetic tenant IDs in adapters, but the core must demand scoped context for all durable operations.
4. **Portable data contracts** with schema/version fields and explicit privacy/classification. Never silently assume currency, locale, time zone, industry or country.
5. **Human approvals** are signed server-side authorizations tied to an immutable plan version and action scope. Approving one action never authorizes modifications, advertising spend, or a different destination.
6. **Idempotent action execution** with action IDs, durable statuses, safe retries, timestamps, external receipts and compensating paths. Never falsely claim that a sandbox simulation is a real social post.
7. **Evidence-first recommendations**: store source, extraction time and provenance, separate observed metrics from estimates/simulations, handle uncertainty, avoid performance fabrication.
8. **Incremental integration**: write unit/contract tests for each port, fixtures and failure modes. Prefer existing Ralion service boundaries and tenant/RLS patterns on later integration, not duplication.
9. **Isolation during hackathon**: no production Supabase, Meta pages, client workspaces, billing or campaign writes. Reintegrate via code review in a dedicated `alinew` PR **after** the hackathon; never copy Git history wholesale or auto-merge.
10. **Public source/IP hygiene**: only sanitize and deliberately publish portable code; separately vet licensing and any commercial trade secrets before publishing.

## Release plan back into Ralion OS
**Stage 1 — Contract compatibility:** compare hackathon models to existing `packages/ai` contracts, publish an API/compatibility matrix, add additive types where possible.

**Stage 2 — Shadow mode:** host the engine within Ralion Growth using a feature flag; read permissioned tenant business context and generate *recommendations only*, with no external actions.

**Stage 3 — Gated pilot:** authorized users explicitly enable workflow approval and sandbox action adapters for a test workspace; trace all output and compare against incumbent Growth recommendations.

**Stage 4 — Controlled production:** enable selected Meta-powered features per workspace with rate/cost limits, regression monitoring, rollback flags and no migration surprises. Reuse Ralion's existing Mari/Growth/Social approval permissions, storage and observability.

## Definition of done for every hackathon feature
- Works independently in the demo environment.
- Exposes documented, versioned portable interfaces.
- Has tests using fake adapters and one integration test using a sandbox implementation.
- Shows exactly which permissions, evidence and configuration are required in Ralion.
- Has an integration note explaining what to reuse and what to replace upon upstreaming.
