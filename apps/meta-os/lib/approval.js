/**
 * RALION OS — HUMAN APPROVAL GOVERNANCE GATEWAY
 *
 * Server-side immutable approval records for marketing campaigns.
 * Strictly enforces that:
 * - Human approval is explicit, signed, and identity-bound.
 * - Approving an action only permits 'LOCAL_DRAFT_ONLY'.
 * - Any ad spend or direct publishing is forbidden in this phase.
 * - Approvals are cryptographically bound to a SHA-256 hash of the exact mission plan.
 */

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const PERMITTED_APPROVAL_ROLES = Object.freeze([
  'owner',
  'growth_admin',
  'marketing_lead'
]);

export const AUTHORIZED_ACTION_SCOPES = Object.freeze([
  'LOCAL_DRAFT_ONLY'
]);

/**
 * Computes a deterministic SHA-256 hash of the mission plan to guarantee tamper resistance.
 */
export function hashMissionPlan(mission) {
  if (!mission || typeof mission !== 'object') throw new Error('APPROVAL_INVALID_MISSION');
  const canonical = {
    missionId: mission.missionId,
    business: mission.business,
    growth: mission.growth?.opportunity || '',
    creative: {
      brief: mission.creative?.brief || '',
      assets: Array.isArray(mission.creative?.assets) ? mission.creative.assets.map(a => ({ assetId: a.assetId, prompt: a.prompt, mimeType: a.mimeType, bytes: a.bytes, sha256: a.sha256, reviewStatus: a.reviewStatus })) : []
    },
    social: Array.isArray(mission.social) ? mission.social.map(s => ({ channel: s.channel, copy: s.copy, caption: s.caption || '', cta: s.cta || '' })) : []
  };
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

/**
 * Creates an immutable human approval record bound to an exact mission plan version.
 */
export function recordHumanApproval(mission, {
  actorId,
  role,
  decision = 'APPROVED',
  scope = 'LOCAL_DRAFT_ONLY',
  notes = '',
  organizationId,
  workspaceId,
  hmacSecret,
  now = Date.now()
} = {}) {
  const actor = String(actorId || '').trim();
  const actorRole = String(role || '').toLowerCase().trim();
  const org = String(organizationId || '').trim();
  const ws = String(workspaceId || '').trim();

  if (!actor) throw new Error('APPROVAL_ACTOR_REQUIRED');
  if (!PERMITTED_APPROVAL_ROLES.includes(actorRole)) throw new Error('APPROVAL_ROLE_UNAUTHORIZED');
  if (!org || !ws) throw new Error('APPROVAL_TENANT_REQUIRED');
  if (!['APPROVED', 'REJECTED'].includes(decision)) throw new Error('APPROVAL_DECISION_INVALID');
  if (!AUTHORIZED_ACTION_SCOPES.includes(scope)) throw new Error('APPROVAL_SCOPE_UNAUTHORIZED');
  if (!hmacSecret) throw new Error('APPROVAL_SECRET_REQUIRED');

  const planHash = hashMissionPlan(mission);
  const approvalId = 'appr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const timestamp = new Date(now).toISOString();

  // Signature payload: binds approvalId, missionId, planHash, actorId, and scope
  const sigPayload = `${approvalId}:${mission.missionId}:${planHash}:${actor}:${actorRole}:${decision}:${scope}:${timestamp}`;
  const signature = createHmac('sha256', hmacSecret).update(sigPayload, 'utf8').digest('hex');

  return Object.freeze({
    approvalId,
    missionId: mission.missionId,
    organizationId: org,
    workspaceId: ws,
    decision,
    scope,
    prohibitsExternalSpend: true,
    prohibitsDirectPublishing: true,
    actor: {
      id: actor,
      role: actorRole
    },
    notes: String(notes || '').slice(0, 500),
    planHash,
    approvedAt: timestamp,
    signature
  });
}

/**
 * Verifies that an approval record is authentic and matches the current mission state.
 */
export function verifyApprovalRecord(approvalRecord, mission, { hmacSecret } = {}) {
  if (!approvalRecord || typeof approvalRecord !== 'object') return false;
  if (!hmacSecret) return false;

  const currentPlanHash = hashMissionPlan(mission);
  if (approvalRecord.planHash !== currentPlanHash) {
    return false; // Mission was modified after approval
  }

  const sigPayload = `${approvalRecord.approvalId}:${approvalRecord.missionId}:${approvalRecord.planHash}:${approvalRecord.actor.id}:${approvalRecord.actor.role}:${approvalRecord.decision}:${approvalRecord.scope}:${approvalRecord.approvedAt}`;
  const expectedSig = createHmac('sha256', hmacSecret).update(sigPayload, 'utf8').digest('hex');

  const a = Buffer.from(approvalRecord.signature || '', 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
