import fs from 'node:fs';
import path from 'node:path';
import { buildChannelDrafts } from './social-copy.js';

/**
 * RALION META OS — BUSINESS MEMORY & REVIEW LESSONS
 *
 * Implements workspace-isolated memory of human review decisions:
 * - Append-only storage of approvals, edits, and rejections.
 * - Lessons derived strictly from review outcomes (what was approved, edited, or rejected).
 * - Every lesson MUST cite its source decisions (mission IDs + timestamps).
 * - Zero simulated metrics, zero fabricated performance.
 * - Strictly tenant-isolated: cross-workspace reads are forbidden.
 * - Documented local storage (.data/memory/<org>/<ws>/) with /tmp serverless fallback.
 */

export function memoryStorageDir() {
  return process.env.MEMORY_STORAGE_DIR || path.join(process.cwd(), '.data', 'memory');
}

/**
 * Validates tenant identifiers strictly to prevent path escape.
 */
export function validateTenantKey(id, label = 'tenant') {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_\-]+$/.test(id) || id.length > 64) {
    throw new Error(`INVALID_${label.toUpperCase()}_ID`);
  }
  return id;
}

/**
 * Returns isolated storage directory for a tenant's memory records.
 */
export function tenantMemoryDir(tenant, root = memoryStorageDir()) {
  if (!tenant || typeof tenant !== 'object') {
    throw new Error('TENANT_REQUIRED');
  }
  const org = validateTenantKey(tenant.organizationId, 'organization');
  const ws = validateTenantKey(tenant.workspaceId, 'workspace');

  let baseDir = path.resolve(root, org, ws);
  try {
    fs.mkdirSync(baseDir, { recursive: true });
  } catch (err) {
    // Serverless (e.g. AWS Lambda / Vercel EROFS) fallback to /tmp
    const tmpRoot = path.join(process.env.TMPDIR || '/tmp', 'ralion-meta-memory');
    baseDir = path.resolve(tmpRoot, org, ws);
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * Computes draft deltas between original generated drafts and approved drafts.
 */
export function computeDraftEdits(originalDrafts = [], approvedDrafts = []) {
  const edits = [];
  const approvedMap = new Map();
  for (const d of approvedDrafts) {
    if (d && d.channel) approvedMap.set(d.channel, d);
  }

  for (const orig of originalDrafts) {
    if (!orig || !orig.channel) continue;
    const appr = approvedMap.get(orig.channel);
    if (!appr) continue;

    const origCap = String(orig.caption || '').trim();
    const apprCap = String(appr.caption || '').trim();
    const origCta = String(orig.cta || '').trim();
    const apprCta = String(appr.cta || '').trim();

    const captionChanged = origCap !== apprCap;
    const ctaChanged = origCta !== apprCta;

    if (captionChanged || ctaChanged) {
      edits.push({
        channel: orig.channel,
        captionChanged,
        ctaChanged,
        originalCaption: origCap,
        approvedCaption: apprCap,
        originalCta: origCta,
        approvedCta: apprCta
      });
    }
  }

  return edits;
}

/**
 * Appends a decision to the workspace's decision memory.
 */
export function recordDecisionMemory({
  tenant,
  mission,
  decision,
  actor,
  planHash,
  notes = '',
  approvedAt = new Date().toISOString()
} = {}) {
  if (!tenant || !tenant.organizationId || !tenant.workspaceId) {
    throw new Error('TENANT_REQUIRED');
  }
  if (!mission || !mission.missionId) {
    throw new Error('MISSION_REQUIRED');
  }
  const dec = String(decision || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(dec)) {
    throw new Error('INVALID_DECISION: Must be APPROVED or REJECTED');
  }

  const dir = tenantMemoryDir(tenant);
  const filePath = path.join(dir, 'decisions.jsonl');

  // Derive original baseline drafts to calculate honest edit deltas
  let originalDrafts = [];
  try {
    originalDrafts = buildChannelDrafts(mission);
  } catch (_) {
    originalDrafts = [];
  }

  const approvedDrafts = Array.isArray(mission.social) ? mission.social : [];
  const edits = dec === 'APPROVED' ? computeDraftEdits(originalDrafts, approvedDrafts) : [];
  const channels = approvedDrafts.map(s => s.channel).filter(Boolean);

  const formats = Array.isArray(mission.creative?.assets)
    ? mission.creative.assets.map(a => a.requestedFormat?.label || a.requestedFormat || '1:1 Square')
    : [];

  const memoryId = `mem_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const record = {
    memoryId,
    missionId: String(mission.missionId).trim(),
    timestamp: approvedAt,
    decision: dec,
    actor: {
      id: String(actor?.id || actor || 'unknown').slice(0, 100),
      role: String(actor?.role || 'owner').slice(0, 50)
    },
    planHash: String(planHash || mission.approval?.planHash || '').slice(0, 128),
    briefType: String(mission.creativeSeed?.briefId || (mission.growth ? 'growth' : 'mari')).slice(0, 50),
    channels,
    formats,
    wasEdited: edits.length > 0,
    edits,
    notes: String(notes || '').slice(0, 500),
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId
  };

  fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

/**
 * Lists decision memories for a tenant, newest first.
 * Strictly enforces tenant isolation: cross-workspace reads are forbidden.
 */
export function listDecisionMemories(tenant, { limit = 50 } = {}) {
  const dir = tenantMemoryDir(tenant);
  const filePath = path.join(dir, 'decisions.jsonl');

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);

  const records = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      // Strict tenant isolation guard
      if (
        parsed.organizationId === tenant.organizationId &&
        parsed.workspaceId === tenant.workspaceId
      ) {
        records.push(parsed);
      }
    } catch (_) {
      // Ignore corrupt lines
    }
  }

  // Newest first
  records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return records.slice(0, Math.max(1, limit));
}

/**
 * Derives business lessons strictly from decision records.
 *
 * Invariant: Every lesson MUST cite its source decisions (mission IDs + timestamps).
 * A lesson with no cited decisions must not exist.
 */
export function deriveBusinessLessons(memories = []) {
  const valid = Array.isArray(memories) ? memories : [];

  let approvedCount = 0;
  let editedCount = 0;
  let rejectedCount = 0;

  const lessons = [];
  const preferredCtas = new Map();

  for (const m of valid) {
    const source = {
      missionId: m.missionId,
      timestamp: m.timestamp,
      decision: m.decision
    };

    if (m.decision === 'APPROVED') {
      approvedCount++;

      // Track preferred CTAs from approved drafts
      if (Array.isArray(m.edits)) {
        for (const ed of m.edits) {
          if (ed.ctaChanged && ed.approvedCta) {
            preferredCtas.set(ed.channel, (preferredCtas.get(ed.channel) || 0) + 1);
          }
        }
      }

      if (!m.wasEdited) {
        // Pattern 1: Approved untouched -> pattern works
        const briefType = m.briefType || 'growth';
        const channels = m.channels.length > 0 ? m.channels.join(', ') : 'Social drafts';
        lessons.push({
          id: `les_${m.memoryId}_untouched`,
          category: 'APPROVED_PATTERN',
          title: `Untouched approval on ${channels}`,
          summary: `The business accepted ${briefType} messaging without edits. Tone and positioning resonated with the reviewer.`,
          pattern: {
            briefType,
            channels: m.channels,
            formats: m.formats
          },
          sourceDecisions: [source]
        });
      } else {
        // Pattern 2: Edited before approval -> partial; the edit delta is the lesson
        editedCount++;
        for (const ed of m.edits) {
          lessons.push({
            id: `les_${m.memoryId}_${ed.channel.toLowerCase()}_edit`,
            category: 'STYLE_REVISION',
            title: `Reviewer customized ${ed.channel} copy`,
            summary: ed.captionChanged
              ? `Reviewer refined ${ed.channel} caption tone before approving.`
              : `Reviewer adjusted ${ed.channel} call to action.`,
            delta: {
              channel: ed.channel,
              captionChanged: ed.captionChanged,
              ctaChanged: ed.ctaChanged,
              before: ed.originalCaption || ed.originalCta,
              after: ed.approvedCaption || ed.approvedCta
            },
            sourceDecisions: [source]
          });
        }
      }
    } else if (m.decision === 'REJECTED') {
      rejectedCount++;
      // Pattern 3: Rejected -> pattern flagged; never presented as failure analytics, only as not approved by this business
      const channels = m.channels.length > 0 ? m.channels.join(', ') : 'Campaign drafts';
      lessons.push({
        id: `les_${m.memoryId}_rejected`,
        category: 'REJECTED_CONCEPT',
        title: `Concept declined for ${channels}`,
        summary: `Not approved by this business for external deployment. Reviewer preferred a different strategic direction.`,
        pattern: {
          briefType: m.briefType,
          channels: m.channels
        },
        sourceDecisions: [source]
      });
    }
  }

  // INVARIANT CHECK: verify that every single lesson has at least one source decision
  for (const l of lessons) {
    if (!Array.isArray(l.sourceDecisions) || l.sourceDecisions.length === 0) {
      throw new Error(`INVARIANT_VIOLATION: Lesson ${l.id} has no cited source decisions`);
    }
  }

  const hasMemory = approvedCount > 0 || editedCount > 0 || rejectedCount > 0;
  const draftingLabel = approvedCount > 0
    ? `Shaped by ${approvedCount} approved draft(s) in this workspace`
    : 'No previous decision memory in this workspace — using baseline starter template';

  return {
    totalDecisions: valid.length,
    approvedCount,
    editedCount,
    rejectedCount,
    lessons,
    mostRecentAt: valid[0]?.timestamp || null,
    hasMemory,
    draftingLabel,
    disclaimer: 'Learned strictly from human review decisions in this workspace. No market data, ad performance, or simulated audience metrics are used.'
  };
}
