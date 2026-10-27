# Meta Global AI Developer Hackathon — Submission-aligned build contract

## What Ras Ali Labs actually proposed
Ralion OS provides a mature technical foundation. The hackathon deliverable is a **new autonomous Growth Intelligence Engine powered by Meta AI models**, coordinated through MARI.

The proposed user journey is:
1. User supplies a **business website** and growth objectives.
2. MARI analyzes **business context** and audience opportunities.
3. Meta-powered reasoning develops actionable **marketing strategies**.
4. MARI generates **brand-aligned creative concepts** and applies multimodal creative analysis.
5. MARI recommends **Facebook and Instagram** campaign plans.
6. Human reviews and approves any publishing or advertising actions.
7. Authorized actions execute through isolated/sandbox Meta integrations, where available.
8. An evidence-grounded feedback loop evaluates results and recommends measurable improvements.

## Required differentiation
This is **not** a dashboard, a basic RAG app, a social caption generator or a chatbot. Build a demonstrably real **investigate → diagnose → strategize → create → approve → act → measure** workflow with tool execution receipts.

## Reuse vs reimplementation
Read-only reference: `rasali535/alinew`. Selectively port and sanitize only needed interfaces/patterns from MARI, Growth, Creative and Social. Do **not** copy customer/tenant identity maps, Supabase URLs, credentials, private data, billing or unrelated modules. Do not write to the source repository.

## Status / gaps (2026-10-27)
- **Existing:** isolated GitHub/Vercel project; frontend mission concept; business-name/objective form; deterministic demo suggestion generator; approval-gated **local, in-memory** draft.
- **Not yet implemented or verified:** website ingestion, genuine Meta model response, multimodal reasoning, brand alignment from evidence, Facebook/Instagram campaign planning artifacts, durable identity-checked approvals, authorized external campaign action, real performance feedback, end-to-end tests in deployed environment.
- **Caution:** a `READY` build or polished UX is not evidence that an AI model ran or an action executed. Label demos and simulations explicitly.

## Implementation order
P0: Vercel live smoke tests, functioning API and dependency-free tests.
P0: secure website ingestion or permissioned upload with URL safety (block internal/private/link-local addresses, redirects and oversized responses), source/evidence extraction and citations.
P0: actual Meta model reasoning with typed output, retries and measured traces.
P1: a structured growth strategy and brand-aligned Facebook/Instagram campaign briefs plus creative evidence.
P1: persistent state, server-authorized human approval, auditable execution receipts.
P1: a real sandbox-approved action and verified feedback data.
P2: multimodal creative critique/comparison and iteration.
P2: judge-focused demo recording, failures/recovery demonstration, architecture and security report.

## Demo acceptance case
Given a permissioned fictional cafe website + a stated objective, show the web evidence MARI extracted, a real Meta-model-produced audience/strategy/creative brief, specific Facebook and Instagram plan(s), human approval, one real sandbox/isolated authorized action with external result ID or verifiable artifact, and a subsequent feedback recommendation grounded in actual recorded signals. Never fabricate campaign reach, conversions or ROI.
