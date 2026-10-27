import { randomUUID } from 'node:crypto';

export function validateBusiness(input) {
  if (!input || typeof input !== 'object') throw new Error('Business input is required');
  const name = String(input.name ?? '').trim().slice(0, 100);
  const industry = String(input.industry ?? '').trim().slice(0, 100);
  const objective = String(input.objective ?? '').trim().slice(0, 300);
  const audience = String(input.audience ?? '').trim().slice(0, 200);
  if (!name || !industry || !objective) throw new Error('Business name, industry and objective are required');
  return { name, industry, objective, audience: audience || 'Potential customers' };
}

export function makeEvidence(business, metrics = {}) {
  const visits = Number(metrics.visits);
  const leads = Number(metrics.leads);
  const valid = Number.isInteger(visits) && visits >= 0 && visits <= 10_000_000 && Number.isInteger(leads) && leads >= 0 && leads <= visits;
  return { business, metrics: valid ? { visits, leads, conversionRatePercent: visits ? Number((leads / visits * 100).toFixed(2)) : 0 } : null, metricsSource: valid ? 'USER_SUPPLIED_UNVERIFIED' : 'NO_METRICS_PROVIDED' };
}

export function createProposal(evidence, strategy, provider) {
  if (typeof strategy !== 'object' || !strategy) throw new Error('Strategy required');
  for (const key of ['insight', 'action', 'reason', 'successMetric']) if (typeof strategy[key] !== 'string' || !strategy[key].trim()) throw new Error('Invalid strategy: ' + key);
  return { id: randomUUID(), createdAt: new Date().toISOString(), status: 'PENDING_APPROVAL', provider,
    business: evidence.business, evidence: { metrics: evidence.metrics, metricsSource: evidence.metricsSource },
    strategy: Object.fromEntries(['insight', 'action', 'reason', 'successMetric'].map(k => [k, strategy[k].trim().slice(0, 1000)])),
    actionReceipt: null };
}

export function demoStrategy(evidence) {
  const { business, metrics } = evidence;
  return {
    insight: metrics && metrics.visits > 0 ? `User-supplied figures indicate ${metrics.conversionRatePercent}% of visits became leads.` : 'No verified performance data is connected yet; a baseline should be established.',
    action: `Prepare a targeted outreach campaign for ${business.audience} introducing ${business.name}'s ${business.industry.toLowerCase()} offer.`,
    reason: `This draft supports the stated business objective: ${business.objective}. It must be reviewed against real channel data before spending.`,
    successMetric: 'Qualified leads generated during a documented 14-day test'
  };
}

export function approve(proposal, actor) {
  if (proposal.status !== 'PENDING_APPROVAL') throw new Error('Only pending proposals can be approved');
  if (!String(actor ?? '').trim()) throw new Error('Approver identity required');
  proposal.status = 'APPROVED';
  proposal.approval = { actor: String(actor).trim().slice(0, 80), at: new Date().toISOString() };
  return proposal;
}

export function executeDraft(proposal) {
  if (proposal.status !== 'APPROVED') throw new Error('Approval required');
  proposal.status = 'DRAFT_CREATED';
  proposal.actionReceipt = { id: randomUUID(), executedAt: new Date().toISOString(), mode: 'LOCAL_DRAFT_ONLY', action: proposal.strategy.action, actualPerformance: null,
    explanation: 'A local campaign draft was recorded. Nothing was published and no ad spend was incurred.' };
  return proposal;
}
