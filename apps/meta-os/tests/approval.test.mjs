import test from 'node:test';
import assert from 'node:assert/strict';
import { recordHumanApproval, verifyApprovalRecord, hashMissionPlan } from '../lib/approval.js';

const FAKE_SECRET = 'secret_hmac_test_key_12345678901234567890';

const SAMPLE_MISSION = {
  missionId: 'miss_12345678',
  business: { name: 'AromaCraft', objective: 'Increase subscriptions' },
  growth: { opportunity: 'Launch weekday coffee club' },
  social: [{ channel: 'Facebook', copy: 'Join our coffee club' }]
};

test('creates valid, signed human approval record for authorized role', () => {
  const approval = recordHumanApproval(SAMPLE_MISSION, {
    actorId: 'usr_sarah',
    role: 'growth_admin',
    organizationId: 'org_ralion_test',
    workspaceId: 'ws_demo_retail',
    hmacSecret: FAKE_SECRET
  });

  assert.equal(approval.missionId, 'miss_12345678');
  assert.equal(approval.organizationId, 'org_ralion_test');
  assert.equal(approval.workspaceId, 'ws_demo_retail');
  assert.equal(approval.scope, 'LOCAL_DRAFT_ONLY');
  assert.equal(approval.prohibitsExternalSpend, true);
  assert.equal(approval.prohibitsDirectPublishing, true);
  assert.ok(approval.signature.length > 0);

  // Verifies authentically
  assert.equal(verifyApprovalRecord(approval, SAMPLE_MISSION, { hmacSecret: FAKE_SECRET }), true);
});

test('rejects unauthorized roles or missing identity', () => {
  assert.throws(() => recordHumanApproval(SAMPLE_MISSION, {
    actorId: 'usr_anon',
    role: 'viewer', // Unauthorized role
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    hmacSecret: FAKE_SECRET
  }), /APPROVAL_ROLE_UNAUTHORIZED/);

  assert.throws(() => recordHumanApproval(SAMPLE_MISSION, {
    actorId: '',
    role: 'owner',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    hmacSecret: FAKE_SECRET
  }), /APPROVAL_ACTOR_REQUIRED/);

  assert.throws(() => recordHumanApproval(SAMPLE_MISSION, {
    actorId: 'usr_sarah',
    role: 'owner',
    organizationId: '',
    workspaceId: 'ws_1',
    hmacSecret: FAKE_SECRET
  }), /APPROVAL_TENANT_REQUIRED/);
});

test('invalidates approval if mission plan is tampered with', () => {
  const approval = recordHumanApproval(SAMPLE_MISSION, {
    actorId: 'usr_sarah',
    role: 'owner',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    hmacSecret: FAKE_SECRET
  });

  // Tamper with mission content
  const tamperedMission = {
    ...SAMPLE_MISSION,
    growth: { opportunity: 'TAMPERED: Drain ad budget immediately' }
  };

  assert.equal(verifyApprovalRecord(approval, tamperedMission, { hmacSecret: FAKE_SECRET }), false);
});

test('rejects wrong hmac secret during verification', () => {
  const approval = recordHumanApproval(SAMPLE_MISSION, {
    actorId: 'usr_sarah',
    role: 'owner',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    hmacSecret: FAKE_SECRET
  });

  assert.equal(verifyApprovalRecord(approval, SAMPLE_MISSION, { hmacSecret: 'wrong_secret' }), false);
});
