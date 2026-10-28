# Ralion OS Tenancy & Human Approval Architecture Mapping

> **Document Type:** Security & Architectural Lineage Mapping  
> **Source Repository:** `rasali535/alinew` (Tag `ralion-os-v2.5.312`, inspected read-only 2026-10-28)  
> **Target Repository:** `rasali535/ralion-meta-hackathon` (`apps/meta-os`)  
> **Status:** IMPLEMENTATION-READY SPECIFICATION FOR MUSE  

---

## 1. Lineage & Philosophy: "AI Proposes, Humans Dispose"

In production Ralion OS (`rasali535/alinew`), artificial intelligence is never permitted to act autonomously on enterprise resources, inventory, customer communication, or financial ledger entries.

This architectural principle was proven in the production **MARI Smart Stock Receiving** subsystem (`scripts/test-retail-smart-receiving.js`):
> *"Uploading an invoice or packing list NEVER increases stock until explicitly approved and posted by an authorized human manager."*

The Meta AI Edition (`ralion-meta-hackathon`) carries this exact security philosophy into generative AI and omnichannel social growth:
> **AI generates proposals, creative concepts, and channel copy. Humans review and cryptographically approve. The application permanently refuses to publish, execute external actions, or spend funds without separate external integration.**

---

## 2. Production Tenancy Architecture Observed (`rasali535/alinew`)

### 2.1 Multi-Tenant Identification & RLS Boundary
In production Ralion OS:
1. **Hierarchical Multi-Tenancy:** Every enterprise entity is scoped by two mandatory identifiers:
   - `organizationId` (UUID): The legal enterprise / billing entity.
   - `workspaceId` (UUID): The regional branch, retail location, or department.
2. **PostgreSQL Row-Level Security (RLS):** All database tables (`packages/database`) enforce `tenant_id` / `organization_id` policies via Supabase Auth `auth.uid()` and session JWT claims.
3. **Actor Identity:** Every transaction records `actorId` / `userId` and `role` (`owner`, `manager`, `cashier`, `growth_admin`). Cashier roles are strictly forbidden from approving stock or administrative operations (HTTP 403 Forbidden verified in `test-retail-smart-receiving.js`).
4. **Manager Approval Token Claim:** In the retail POS subsystem (`scripts/verify-retail-cashier-security-and-bypass.js`), sensitive actions (discounts, refunds, stock reconciliation) require a manager approval token signed with an HMAC secret and bound to a single-use transaction nonce (`retail_pos_consumed_tokens`). Replays are strictly rejected.

---

## 3. Meta AI Edition Tenancy Implementation (`apps/meta-os`)

### 3.1 V2 Tenant Token Structure (`apps/meta-os/lib/auth.js`)
Meta AI Edition implements clean-room, zero-database tenant authentication using HMAC-SHA256 capability tokens:
```
v2.<organizationId>.<workspaceId>.<expiryMs>.<signature>
```
- **Issuance:** `issueDemoToken(workspaceId, { organizationId, hmacSecret, ttlMs })`
- **Validation:** `verifyAccessToken(token, { hmacSecret, staticToken })`
- **Anti-Tampering:** Signature covers `v2.<organizationId>.<workspaceId>.<expiryMs>`. Any modification to the organization or workspace fails cryptographic verification via `timingSafeEqual`.
- **Legacy Invalidation:** Legacy single-tenant v1 tokens (`v1.demo...`) are rejected with `V1_TOKEN_DEPRECATED`.

### 3.2 Tenant Isolation in Shared Infrastructure
1. **Inference Guard (`lib/inference-access.js`):**
   - Rate limiters and daily model budgets are keyed by the composite tenant tuple: `${organizationId}:${workspaceId}`.
   - Quotas for Workspace A cannot be consumed or exhausted by Workspace B.
2. **Storage Isolation (`lib/creative-store.js`):**
   - Stored assets reside strictly in: `.data/creative/${organizationId}/${workspaceId}/`
   - Strict regex validation prevents directory traversal: `^[a-zA-Z0-9_-]{1,64}$` for org and workspace IDs.
   - Path containment assertion: `targetPath.startsWith(basePath + path.sep)`. Cross-tenant reads return `null` or throw errors.
3. **Signed Capability Previews (`lib/asset-url.js`):**
   - Preview URLs require HMAC capability tokens binding `assetId`, `organizationId`, and `workspaceId`.
   - Access attempts from a different tenant signature are rejected with HTTP 403.

---

## 4. Human Approval Gateway Mapping

### 4.1 Comparison Matrix

| Security Characteristic | Production Ralion OS (`alinew`) | Meta AI Edition (`apps/meta-os`) | Status |
| :--- | :--- | :--- | :--- |
| **Approval Subject** | Stock receiving lines, POS discounts, invoices | Mission plan: Business + Growth + Creative + Social | **COMPATIBLE** |
| **Tamper Invalidation** | Document SHA-256 hash check | Cryptographic plan hash `hashMissionPlan(mission)` | **VERIFIED** |
| **Role Authorization** | PostgreSQL RBAC (`owner`, `manager` allowed; `cashier` 403) | Application role verification (`owner`, `growth_admin`, `marketing_lead` allowed) | **VERIFIED** |
| **Scope Limitation** | Single-transaction inventory update | Explicit `LOCAL_DRAFT_ONLY` forced in all signatures | **VERIFIED** |
| **Execution Lockout** | Database transaction boundary | Execution state permanently locked to `NOT_CONNECTED` | **VERIFIED** |
| **Persistence Layer** | PostgreSQL database table | Process file storage + cryptographically signed JSON | **HACKATHON ISOLATED** |
| **Replay Defense** | Consumed token nonce table in database | Cryptographic plan hash binding (content variation breaks sig) | **VERIFIED** |

### 4.2 Cryptographic Plan Hash Binding (`apps/meta-os/lib/approval.js`)
When an authorized user signs a mission in `apps/meta-os/app/api/mission/approve/route.js`, the signature binds:
1. `business`: `name`, `industry`, `objective`, `website`
2. `growth`: `opportunity`, `reason`, `measurement`
3. `creative`: Every attached asset's `prompt`, `bytes`, and `sha256`
4. `social`: Every channel's `copy`, `caption`, `cta`, and `hashtags`
5. `tenant`: `organizationId`, `workspaceId`
6. `scope`: Strictly `'LOCAL_DRAFT_ONLY'`

```javascript
export function hashMissionPlan(mission) {
  const normalized = {
    business: mission.business || {},
    growth: mission.growth || {},
    creative: (mission.creative && mission.creative.assets ? mission.creative.assets : []).map(a => ({
      prompt: a.prompt,
      bytes: a.bytes,
      sha256: a.sha256
    })),
    social: (mission.social || []).map(s => ({
      channel: s.channel,
      copy: s.copy || s.caption,
      cta: s.cta || '',
      hashtags: s.hashtags || []
    }))
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
```

If an operator edits a single character of the creative prompt, changes an Instagram hashtag, or alters the growth objective after approval has been minted, the recomputed plan hash diverges and the approval is **instantly invalidated**.

---

## 5. Remaining Implementation Gaps & Recommendations for Muse

### Gap 1: In-Memory Ledger vs Persistent Nonce Table
- **Production Precedent:** `retail_pos_consumed_tokens` table in PostgreSQL prevents token reuse across server restarts and distributed instances.
- **Hackathon State:** Approvals are verified stateless by checking the HMAC signature against the current plan hash.
- **Muse Action:** For Phase 4, introduce an append-only JSON audit log in `.data/audit/approval_audit_${org}.jsonl` recording each approval nonce and timestamp.

### Gap 2: Role Authorization Hardening
- **Production Precedent:** Strict PBKDF2 manager PIN verification and RBAC checks.
- **Hackathon State:** `mintMissionApproval` validates `role` against an allowlist (`['owner', 'growth_admin', 'marketing_lead']`).
- **Muse Action:** Maintain the current clean allowlist; do not introduce database dependencies or hardcoded PINs.
