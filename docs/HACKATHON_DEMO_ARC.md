# Ralion Meta AI Edition — 8-Beat Judge Demonstration Arc

> **Document Type:** Hackathon Submission & Demonstration Guide  
> **Source Lineage:** `rasali535/alinew/.artifacts/screenshots/` (Phases 1–8)  
> **Target Application:** `apps/meta-os` (Running on `http://localhost:3600`)  
> **Target Duration:** 2 minutes 45 seconds (Under 3-minute video limit)  
> **Status:** APPROVED DEMO NARRATIVE FOR JUDGING  

---

## 1. Executive Framing for Judges

> *"SMEs and growing businesses worldwide face a crippling AI divide: they lack the multi-million dollar marketing and data engineering teams needed to operate complex AI infrastructure. Ralion OS solves this with an autonomous business operating system. In this Meta AI Edition, we demonstrate how Meta's frontier models — Muse Spark, Muse Wonder, and Muse Image — power an autonomous growth autopilot, strictly governed by cryptographic human approvals."*

The 8-beat narrative directly mirrors the verified production proof in `rasali535/alinew/.artifacts/screenshots/`, transitioning from proprietary third-party LLMs to a sovereign, clean-room Meta AI architecture.

---

## 2. The 8-Beat Demonstration Arc

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Business Intake      → DNS-pinned safe website ingestion                 │
│ 2. MARI Reasoning       → Meta Muse Spark & Wonder strategic diagnosis      │
│ 3. Growth Opportunities → Commercial translation & revenue expansion moves  │
│ 4. Creative Studio      → Guided brief selection & prompt composer          │
│ 5. Image Generation     → Metered Muse Image synthesis & signed previews    │
│ 6. Social Drafting      → Channel-specific cards with safety guard chips    │
│ 7. Human Approval Gate  → Cryptographic hash binding & draft-only lock      │
│ 8. Audit & Governance   → Tamper-rejection proof & simulated learning loop  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Beat-by-Beat Clickpath & Voiceover Script

### Beat 1: Business Context & Grounded Intake (0:00 – 0:25)
- **Screen:** Business Workspace (`/business`)
- **Action:**
  1. Show profile for *Northstar Coffee* (emerging market artisanal café).
  2. Point to the public website field (`https://example.org`).
  3. Click **Send mission to MARI**.
- **Voiceover:**
  > *"Every campaign starts with grounded business reality, not hallucinated assumptions. Here in the Business workspace, we ingest Northstar Coffee's commercial context. Behind the scenes, Ralion OS fetches public website text through a DNS-pinned HTTPS transport that validates IP space on every hop to eliminate SSRF and DNS-rebinding attacks."*
- **Visual Highlight:** Website evidence card displaying word count, excerpt, and content SHA-256 hash.

---

### Beat 2: MARI Strategic Reasoning (0:25 – 0:50)
- **Screen:** MARI Workspace (`/mari`)
- **Action:**
  1. Show the workflow stepper advancing from Intake to Diagnosis.
  2. Toggle between **Muse Spark 1.3** (fast operational reasoning) and **Muse Wonder 1.0** (deep chain-of-thought analysis).
  3. Highlight the grounded diagnosis output and deterministic fallback draft.
- **Voiceover:**
  > *"MARI — our Autonomous Reasoning Intelligence — coordinates the mission. Using Meta's Responses API with Muse Spark for speed or Muse Wonder for deep strategic planning, MARI analyzes customer commuting patterns and identifies that morning customer frequency can be doubled through artisanal breakfast pairing concepts."*
- **Visual Highlight:** Stepper indicators, Model Badge (`Muse Spark`), and organization/workspace tenant labels.

---

### Beat 3: Growth Opportunity Translation (0:50 – 1:10)
- **Screen:** Growth Workspace (`/growth`)
- **Action:**
  1. Display the translated strategic action card: *"Artisanal Morning Commute Campaign"*.
  2. Review the explainable drivers: Why MARI recommends this, required effort (Low), and expected commercial outcome.
- **Voiceover:**
  > *"In the Growth Center, raw AI reasoning is translated into explainable commercial actions. MARI details the strategic rationale, estimated impact, and metric measurement plan, ensuring the business owner understands exactly why this campaign was proposed."*
- **Visual Highlight:** Priority badge (`HIGH`), category (`MARKETING_ACQUISITION`), and grounded proof citations.

---

### Beat 4: Creative Studio & Safety Confirmation (1:10 – 1:35)
- **Screen:** Creative Studio (`/creative`)
- **Action:**
  1. Select brief source: **Growth opportunity**.
  2. Click **Use brief suggestion** to populate the prompt.
  3. Edit prompt to: *"Artisanal morning espresso on wooden rustic table with fresh croissants"*.
  4. Attempt to click **Generate image** without checking confirmation.
  5. Show safety rejection banner: *"Confirm the request first: every generation may be billable."*
- **Voiceover:**
  > *"Next, the Creative Studio transforms the brief into visual concepts. Notice our safety-first boundary: clicking generate without explicit confirmation is rejected. Ralion OS prevents runaway AI costs by requiring explicit human authorization for every billable inference request."*
- **Visual Highlight:** Error banner displaying confirmation guard requirement.

---

### Beat 5: Authorized Creative Asset Generation (1:35 – 2:00)
- **Screen:** Creative Studio (`/creative`)
- **Action:**
  1. Check `#gen-confirm`: *"I authorize this image request"*.
  2. Click **Generate image**.
  3. Show the newly generated asset card in the gallery with signed capability preview.
  4. Inspect asset metadata: bytes, SHA-256, and `Pending review` badge.
- **Voiceover:**
  > *"With authorization confirmed, the asset is synthesized via Meta Muse Image. The image binary is stored in tenant-isolated storage, and rendered via a cryptographically signed capability URL with a strict 15-minute expiry. No unauthenticated user can ever access tenant media."*
- **Visual Highlight:** Capability token in preview URL (`/api/creative/asset?id=...&sig=...`) and review badges.

---

### Beat 6: Omnichannel Social Drafting (2:00 – 2:20)
- **Screen:** Social Workspace (`/social`)
- **Action:**
  1. View Facebook draft card: Storytelling caption, morning coffee hook, and clear CTA.
  2. View Instagram draft card: Curated hashtags (`#morningcoffee`, `#espresso`) bounded to 5 tags.
  3. Point to the creative thumbnail preview.
  4. Point to the safety chips: `NOT PUBLISHED · PUBLISHING NOT APPROVED`.
- **Voiceover:**
  > *"In the Social workspace, MARI composes channel-specific campaigns tailored for Facebook storytelling and Instagram visual feeds. Notice the safety chip: NOT PUBLISHED, PUBLISHING NOT APPROVED. Nothing is scheduled or dispatched to Meta Graph APIs without human sign-off."*
- **Visual Highlight:** `NOT PUBLISHED` guard chip and grounded evidence chips on cards.

---

### Beat 7: Cryptographic Human Approval Gateway (2:20 – 2:35)
- **Screen:** Social Workspace — Human Approval Card (`/social`)
- **Action:**
  1. Enter approver identity: *"Alice Marketing Lead"*.
  2. Select role: **Marketing lead**.
  3. Click **Approve drafts**.
  4. Show success banner: *"Approved by Alice Marketing Lead (marketing_lead) · Scope: local drafts only"*.
- **Voiceover:**
  > *"Here is the core of Ralion OS governance: the Human Approval Gateway. When Alice signs off, the server mints an HMAC cryptographic record binding the exact prompt, image bytes, and channel copy. The scope is strictly locked to local drafts only."*
- **Visual Highlight:** Green confirmation banner displaying cryptographic approval ID and local-draft scope.

---

### Beat 8: Governance, Tamper Invalidation & Learning (2:35 – 2:45)
- **Screen:** Activity & Audit Workspace (`/activity`)
- **Action:**
  1. Demonstrate tamper rejection: modifying any draft text instantly breaks the cryptographic signature.
  2. Show verified audit trail: Execution status is permanently locked to `NOT_CONNECTED`.
  3. Close with the learning loop summary.
- **Voiceover:**
  > *"If any prompt or hashtag is altered post-approval, the plan hash diverges and the approval is instantly invalidated. With 128 automated regression tests and complete browser verification, Ralion Meta AI Edition proves enterprise AI can be sovereign, safe, and built for emerging businesses worldwide."*
- **Visual Highlight:** Green test badge (`128 passing`), verified audit ledger, and clean system state.

---

## 4. Acceptance Checklist for Video Recording

- [ ] Dev server running cleanly on `http://localhost:3600` (zero console warnings or hydration errors).
- [ ] Dark theme active with crisp glassmorphic UI.
- [ ] Full workflow executed end-to-end: Business → MARI → Growth → Creative → Social → Approval.
- [ ] Confirmation error explicitly demonstrated in Creative Studio.
- [ ] Signed preview image rendered cleanly in both Creative and Social workspaces.
- [ ] Spoken duration clocked between 2:30 and 2:50.
- [ ] Zero billable Meta calls made during the recording.
