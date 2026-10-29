import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  recordDecisionMemory,
  listDecisionMemories,
  deriveBusinessLessons,
  computeDraftEdits,
  validateTenantKey
} from '../lib/memory.js';
import { buildChannelDrafts } from '../lib/social-copy.js';

test('validateTenantKey rejects path traversal and invalid characters', () => {
  assert.equal(validateTenantKey('org_demo'), 'org_demo');
  assert.equal(validateTenantKey('demo-ws-123'), 'demo-ws-123');

  assert.throws(() => validateTenantKey('../escape'), /INVALID_TENANT_ID/);
  assert.throws(() => validateTenantKey('org/sub'), /INVALID_TENANT_ID/);
  assert.throws(() => validateTenantKey('ws\\sub'), /INVALID_TENANT_ID/);
  assert.throws(() => validateTenantKey(''), /INVALID_TENANT_ID/);
  assert.throws(() => validateTenantKey('a'.repeat(70)), /INVALID_TENANT_ID/);
});

test('computeDraftEdits detects before/after caption and CTA modifications', () => {
  const orig = [
    { channel: 'Facebook', caption: 'Original Facebook caption', cta: 'Learn more' },
    { channel: 'Instagram', caption: 'Original Instagram caption', cta: 'Explore now' }
  ];
  const approved = [
    { channel: 'Facebook', caption: 'Refined Facebook caption for locals', cta: 'Learn more' },
    { channel: 'Instagram', caption: 'Original Instagram caption', cta: 'Claim offer now' }
  ];

  const edits = computeDraftEdits(orig, approved);
  assert.equal(edits.length, 2);

  const fb = edits.find(e => e.channel === 'Facebook');
  assert.ok(fb);
  assert.equal(fb.captionChanged, true);
  assert.equal(fb.ctaChanged, false);
  assert.equal(fb.originalCaption, 'Original Facebook caption');
  assert.equal(fb.approvedCaption, 'Refined Facebook caption for locals');

  const ig = edits.find(e => e.channel === 'Instagram');
  assert.ok(ig);
  assert.equal(ig.captionChanged, false);
  assert.equal(ig.ctaChanged, true);
  assert.equal(ig.originalCta, 'Explore now');
  assert.equal(ig.approvedCta, 'Claim offer now');
});

test('recordDecisionMemory appends decisions and enforces tenant isolation', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ralion-memory-test-'));
  process.env.MEMORY_STORAGE_DIR = tmpRoot;

  try {
    const tenantA = { organizationId: 'tenantA', workspaceId: 'ws_alpha' };
    const tenantB = { organizationId: 'tenantB', workspaceId: 'ws_beta' };

    const missionA1 = {
      missionId: 'mis_001',
      business: { name: 'Alpha Roasters', objective: 'Grow morning sales' },
      growth: { opportunity: 'Morning coffee commuters' }
    };
    missionA1.social = buildChannelDrafts(missionA1);

    const missionA2 = {
      missionId: 'mis_002',
      business: { name: 'Alpha Roasters', objective: 'Grow morning sales' },
      growth: { opportunity: 'Morning coffee commuters' }
    };
    missionA2.social = buildChannelDrafts(missionA2).map((s, idx) =>
      idx === 0 ? { ...s, caption: 'Custom refined copy for weekend regulars' } : s
    );

    const missionB1 = {
      missionId: 'mis_b01',
      business: { name: 'Beta Bakery', objective: 'Grow pastry sales' }
    };
    missionB1.social = buildChannelDrafts(missionB1);

    // Record decision 1 for Tenant A: Approved untouched
    const recA1 = recordDecisionMemory({
      tenant: tenantA,
      mission: missionA1,
      decision: 'APPROVED',
      actor: { id: 'alice', role: 'owner' },
      planHash: 'hash_alpha_1',
      approvedAt: '2026-10-28T10:00:00.000Z'
    });
    assert.equal(recA1.decision, 'APPROVED');
    assert.equal(recA1.missionId, 'mis_001');
    assert.equal(recA1.wasEdited, false);

    // Record decision 2 for Tenant A: Approved with edits
    const recA2 = recordDecisionMemory({
      tenant: tenantA,
      mission: missionA2,
      decision: 'APPROVED',
      actor: { id: 'alice', role: 'owner' },
      planHash: 'hash_alpha_2',
      approvedAt: '2026-10-28T11:00:00.000Z'
    });
    assert.equal(recA2.decision, 'APPROVED');
    assert.equal(recA2.wasEdited, true);

    // Record decision for Tenant B
    recordDecisionMemory({
      tenant: tenantB,
      mission: missionB1,
      decision: 'APPROVED',
      actor: { id: 'bob', role: 'owner' },
      planHash: 'hash_beta_1',
      approvedAt: '2026-10-28T12:00:00.000Z'
    });

    // Query Tenant A memories
    const listA = listDecisionMemories(tenantA);
    assert.equal(listA.length, 2);
    assert.equal(listA[0].missionId, 'mis_002'); // Newest first
    assert.equal(listA[1].missionId, 'mis_001');

    // Query Tenant B memories (Tenant isolation guarantee)
    const listB = listDecisionMemories(tenantB);
    assert.equal(listB.length, 1);
    assert.equal(listB[0].missionId, 'mis_b01');
    assert.equal(listB[0].organizationId, 'tenantB');

    // Cross-workspace read verification: Tenant A never sees Tenant B records
    assert.ok(!listA.some(m => m.organizationId === 'tenantB'));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    delete process.env.MEMORY_STORAGE_DIR;
  }
});

test('deriveBusinessLessons enforces invariant: every lesson must cite source decisions', () => {
  const memories = [
    {
      memoryId: 'mem_1',
      missionId: 'mis_100',
      timestamp: '2026-10-28T09:00:00.000Z',
      decision: 'APPROVED',
      wasEdited: false,
      briefType: 'growth',
      channels: ['Facebook', 'Instagram'],
      formats: ['1:1 Square']
    },
    {
      memoryId: 'mem_2',
      missionId: 'mis_200',
      timestamp: '2026-10-28T10:30:00.000Z',
      decision: 'APPROVED',
      wasEdited: true,
      channels: ['Facebook'],
      edits: [
        {
          channel: 'Facebook',
          captionChanged: true,
          ctaChanged: false,
          originalCaption: 'Default caption',
          approvedCaption: 'Locally tailored weekend espresso invite'
        }
      ]
    },
    {
      memoryId: 'mem_3',
      missionId: 'mis_300',
      timestamp: '2026-10-28T14:00:00.000Z',
      decision: 'REJECTED',
      channels: ['Facebook', 'Instagram'],
      briefType: 'custom'
    }
  ];

  const lessonsResult = deriveBusinessLessons(memories);
  assert.equal(lessonsResult.totalDecisions, 3);
  assert.equal(lessonsResult.approvedCount, 2);
  assert.equal(lessonsResult.editedCount, 1);
  assert.equal(lessonsResult.rejectedCount, 1);

  assert.ok(lessonsResult.lessons.length >= 3);

  // INVARIANT VERIFICATION
  for (const lesson of lessonsResult.lessons) {
    assert.ok(
      Array.isArray(lesson.sourceDecisions) && lesson.sourceDecisions.length > 0,
      `Lesson ${lesson.id} violated invariant: missing cited source decisions`
    );
    for (const src of lesson.sourceDecisions) {
      assert.ok(typeof src.missionId === 'string' && src.missionId.length > 0);
      assert.ok(typeof src.timestamp === 'string' && src.timestamp.length > 0);
      assert.ok(['APPROVED', 'REJECTED'].includes(src.decision));
    }
  }

  // Check categories and descriptions
  const untouchedLesson = lessonsResult.lessons.find(l => l.category === 'APPROVED_PATTERN');
  assert.ok(untouchedLesson);
  assert.equal(untouchedLesson.sourceDecisions[0].missionId, 'mis_100');

  const editLesson = lessonsResult.lessons.find(l => l.category === 'STYLE_REVISION');
  assert.ok(editLesson);
  assert.equal(editLesson.sourceDecisions[0].missionId, 'mis_200');
  assert.ok(editLesson.delta.after.includes('Locally tailored'));

  const rejectedLesson = lessonsResult.lessons.find(l => l.category === 'REJECTED_CONCEPT');
  assert.ok(rejectedLesson);
  assert.equal(rejectedLesson.sourceDecisions[0].missionId, 'mis_300');
  // Rejection is never presented as failure analytics
  assert.ok(!rejectedLesson.summary.toLowerCase().includes('failure'));
  assert.ok(rejectedLesson.summary.includes('Not approved by this business'));

  // Drafting label
  assert.equal(
    lessonsResult.draftingLabel,
    'Shaped by 2 approved draft(s) in this workspace'
  );
});

test('deriveBusinessLessons handles empty memory cleanly without inventing lessons', () => {
  const result = deriveBusinessLessons([]);
  assert.equal(result.totalDecisions, 0);
  assert.equal(result.approvedCount, 0);
  assert.equal(result.lessons.length, 0);
  assert.equal(result.hasMemory, false);
  assert.equal(
    result.draftingLabel,
    'No previous decision memory in this workspace — using baseline starter template'
  );
});

test('buildChannelDrafts integrates memory shaping label when lessons provided', () => {
  const mission = {
    business: { name: 'Northstar Coffee', objective: 'Increase weekday morning visits' },
    growth: { opportunity: 'Commuter pickup promotion' }
  };

  // Without memory
  const draftsBaseline = buildChannelDrafts(mission);
  assert.equal(draftsBaseline.length, 2);
  assert.equal(
    draftsBaseline[0].grounding.memory,
    'No previous decision memory in this workspace — using baseline starter template'
  );

  // With memory (3 approved drafts)
  const draftsWithMemory = buildChannelDrafts(mission, {
    lessons: { approvedCount: 3 }
  });
  assert.equal(draftsWithMemory.length, 2);
  assert.equal(
    draftsWithMemory[0].grounding.memory,
    'Shaped by 3 approved draft(s) in this workspace'
  );
});
