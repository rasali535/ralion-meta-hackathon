# Muse CLI & Anti Coordination Architecture

## 1. Clear Separation of Concepts

It is critical to distinguish between the **Muse developer CLI** and the **Meta Model API**:

| Component | Nature | Location | Primary Role |
| :--- | :--- | :--- | :--- |
| **Muse Terminal Session** (`muse`) | Developer CLI Agent | `c:\Users\Ras Ali Labs\Desktop\ralion-meta-os-dev` | Interactive coding and terminal execution. Active model in the running session: `muse-spark-1.3-contributor` (the `muse-wonder.example.toml` file is an example config, not the session's model). See `MUSE_CODE_DEVELOPMENT.md`. |
| **Meta Model API: Spark** (`muse-spark-1.3`) | Server-side Wire API | `POST https://api.meta.ai/v1/responses` | Fast runtime reasoning for MARI Growth Autopilot. |
| **Meta Model API: Wonder** (`muse-wonder-1.0`) | Server-side Wire API | `POST https://api.meta.ai/v1/responses` | High-effort deep reasoning for complex opportunity synthesis. |
| **Meta Model API: Image** (`muse-image-1.0`) | Server-side Wire API | `POST https://api.meta.ai/v1/images/generations` | Creative concept generation producing verified image assets. |

The running terminal session is **not** an image generator or a client app runtime; it is an active developer peer in the engineering environment.

---

## 2. Collaborative Division of Labor

```
+---------------------------------------------------------------------------------+
|                               DEVELOPMENT TIERS                                 |
+---------------------------------------------------------------------------------+
|                                                                                 |
|   [ ANTI (Antigravity Assistant) ]           [ MUSE (Meta Developer CLI) ]      |
|   - Architecture & System Contracts          - Live Terminal Execution Context  |
|   - Next.js Foundation & API Routes          - In-Session Model Querying        |
|   - Test Automation (`node:test`)            - Local file/test tool calls        |
|   - Security Guardrails & Scrubbing          - Interactive CLI Probing          |
|   - Tenant Isolation Scaffolding             - Local Shell Verification         |
|                          \                         /                            |
|                           \                       /                             |
|                        +-----------------------------+                          |
|                        |   RALION META HACKATHON     |                          |
|                        |   - Clean Type Contracts    |                          |
|                        |   - Isolated App Runtime    |                          |
|                        |   - Meta API Adapters       |                          |
|                        +-----------------------------+                          |
+---------------------------------------------------------------------------------+
```

### Protocol for Session Preservation:
1. **Never kill or restart the Muse terminal session**: Retain active session context, token state, and process memory.
2. **Synchronize via git & filesystem contracts**: Anti prepares code, contracts, and test files; Muse exercises them in the authenticated terminal context.
3. **Zero credential duplication**: Maintain credentials strictly server-side in the execution environment; do not commit keys or log tokens in shared artifacts.

---

## 3. Phase 2 MARI Integration Blueprint

When Phase 2 begins:
1. **Core Package Extraction**: Extract the engine into `@ralion/growth-intelligence-core` using the portable contracts in `src/contracts/`.
2. **Pluggable Model Provider**: Connect `apps/meta-os/lib/meta/provider.js` to implement the versioned `CreativeProvider` and `ModelProvider` ports.
3. **Human Approval Gateway**: Wire all external publishing and spending proposals behind immutable approval receipts.
4. **Tenant Isolation**: Require explicit `organizationId` and `workspaceId` metadata before triggering inference.
