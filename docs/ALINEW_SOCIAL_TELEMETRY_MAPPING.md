# Ralion OS Social Adapters & Telemetry Architecture Mapping

> **Document Type:** Integration & Telemetry Architecture Reference  
> **Source Repository:** `rasali535/alinew` (Tag `ralion-os-v2.5.312`, inspected read-only 2026-10-28)  
> **Target Repository:** `rasali535/ralion-meta-hackathon` (`apps/meta-os`)  
> **Status:** IMPLEMENTATION-READY SPECIFICATION FOR MUSE  

---

## 1. Executive Summary

In production Ralion OS (`rasali535/alinew`), social publishing is operated through an official provider adapter architecture (`packages/integrations/src/social/`), and AI token consumption is metered through a durable, idempotent telemetry service (`packages/ai/src/tokenTelemetry.service.ts`).

For the **Meta AI Edition** hackathon submission:
1. **Social Publishing Boundary:** Live publishing remains **strictly disabled**. Facebook and Instagram drafts are presented as review-only cards with safety badges (`NOT PUBLISHED · PUBLISHING NOT APPROVED`).
2. **Telemetry Boundary:** Durable database writes are replaced by clean-room, in-memory rate limiting and workspace inference budgeting, with a defined migration path to production telemetry.

---

## 2. Production Social Media Architecture Observed (`rasali535/alinew`)

### 2.1 The `SocialProvider` Base Abstraction (`packages/integrations/src/social/SocialProvider.ts`)
Production Ralion OS decouples social platforms from business logic using an abstract class:

```typescript
export abstract class SocialProvider {
  abstract readonly platform: SocialPlatformType;
  abstract readonly displayName: string;
  abstract readonly defaultScopes: string[];

  abstract getCapabilities(scopes?: string[]): SocialCapabilities;
  abstract getAuthorizationUrl(state: string, redirectUri: string): string;
  abstract handleCallback(code: string, redirectUri: string): Promise<SocialAuthResult>;
  abstract refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn?: number }>;
  abstract getProfile(accessToken: string): Promise<SocialProfile>;
  abstract publish(accessToken: string, params: PublishContentParams): Promise<PublishResponse>;
  abstract deletePost(accessToken: string, postId: string): Promise<boolean>;
  abstract getAnalytics(accessToken: string, accountId: string): Promise<SocialAnalyticsResult>;
  abstract healthCheck(accessToken: string): Promise<ConnectionHealthResult>;
}
```

### 2.2 Official Meta (Facebook & Instagram) Adapters
1. **`MetaProvider.ts` (Facebook):**
   - **Target API:** Official Meta Graph API `v24.0+`.
   - **Required Scopes:** `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `business_management`.
   - **Error Mapping:** Converts raw Meta error subcodes to HTTP status codes (e.g., token expiry subcodes 458/459 -> 401; missing page permission -> 403; duplicate content code 506 -> 409; call rate limit code 32/613 -> 429).
   - **Credential Redaction:** Enforces `sanitizeMetaErrorMessage` to scrub `EA[A-Za-z0-9]+` tokens and `access_token=[REDACTED]`.
2. **`InstagramProvider.ts` (Instagram):**
   - **Target API:** Official Instagram Graph API `v26.0`.
   - **Required Scopes:** `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`.
   - **Capabilities:** Media container creation (`POST /{ig-user-id}/media`), status checking (`GET /{container-id}`), and publication (`POST /{ig-user-id}/media_publish`).
3. **Dormant Adapters:** Production includes dormant scaffolding for LinkedIn, TikTok, WhatsApp Cloud API, X (Twitter), and Zernio.

---

## 3. Meta AI Edition Implementation (`apps/meta-os`)

### 3.1 Clean-Room Social Copy Generation (`apps/meta-os/lib/social-copy.js`)
Instead of directly invoking third-party APIs, Meta AI Edition generates structured, channel-optimized draft campaigns:
- **Facebook Drafts:** Focus on narrative storytelling, community engagement, business differentiators, and a clear call to action.
- **Instagram Drafts:** Focus on concise visual hooks, curated hashtags (bounded to maximum 5), and grounding chips.
- **Fact Grounding Enforcement:** Every draft card includes a `.chip-row` labeling the source (`MISSION_DRAFT_DERIVED` or website evidence) so unverified claims are never presented as facts.

### 3.2 Human Approval & Publishing Safety Boundary (`apps/meta-os/app/views/social.jsx`)
In the Social workspace:
- Every card displays a prominent guard chip: `NOT PUBLISHED · PUBLISHING NOT APPROVED`.
- A global warning banner reminds operators: *"Nothing here is published, scheduled, or approved for publishing."*
- Even after cryptographic approval is minted, the banner displays: `Scope: local drafts only · Execution: NOT_CONNECTED`.

---

## 4. Production Telemetry Architecture Observed (`rasali535/alinew`)

### 4.1 Canonical Telemetry Service (`packages/ai/src/tokenTelemetry.service.ts`)
In production:
```typescript
export interface TokenUsageRecord {
  id: string;
  organizationId: string;
  userId?: string;
  requestId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  timestamp: string;
}

export class MariTokenTelemetryService {
  static async recordUsage(params: {
    organizationId: string;
    userId?: string;
    requestId: string;
    provider?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<TokenUsageRecord>;
}
```
**Key Invariants:**
1. **Idempotency by `requestId`:** Duplicate calls with the same provider request ID are ignored to prevent double-charging on network retries.
2. **Provider-Reported Usage:** Strictly records actual provider tokens rather than client-side estimations.
3. **Workspace Cumulative Metering:** Aggregates spend per tenant for billing and quota enforcement.

---

## 5. Meta AI Edition Telemetry & Budgeting Implementation (`apps/meta-os`)

### 5.1 Two-Phase Inference Ledger (`apps/meta-os/lib/budget.js` & `lib/inference-access.js`)
Meta AI Edition implements an atomic in-memory reservation ledger:
1. **`reserveInferenceUsage({ organizationId, workspaceId, mode })`**:
   - Atomically checks daily quotas (100 Spark, 25 Wonder, 10 Image calls).
   - Generates an in-flight receipt: `rcpt_${uuid}`.
   - Throws HTTP 429 if quota is exhausted.
2. **`settleInferenceUsage(receipt, { requestId, ok })`**:
   - If `ok: true`: Confirms quota deduction, records `requestId` for idempotency, and records timestamp.
   - If `ok: false`: Immediately rolls back the reserved quota, ensuring failed calls do not penalize the tenant.

---

## 6. Remaining Gaps & Recommendations for Muse

### Recommendation 1: Clean-Room `MockMetaSocialProvider`
To demonstrate how post-hackathon publishing connects without touching live APIs, Muse can introduce an offline provider adapter in `apps/meta-os/lib/social-provider.js`:
```javascript
export class MockMetaSocialProvider {
  readonly platform = 'facebook';
  async publish(contract) {
    // Clean-room validation: asserts approval is valid and scope is LOCAL_DRAFT_ONLY
    return {
      success: true,
      simulatedPostId: `mock_fb_${Date.now()}`,
      status: 'SIMULATED_DRAFT_READY',
      publishedAt: new Date().toISOString()
    };
  }
}
```

### Recommendation 2: Structured Telemetry Emission
Enhance `settleInferenceUsage` in `apps/meta-os/lib/inference-access.js` to emit a canonical `TokenUsageRecord` structure, storing it in an append-only memory buffer or `.data/telemetry/tokens_${org}.jsonl`. This matches the exact shape required by `MariTokenTelemetryService` in `alinew`.
