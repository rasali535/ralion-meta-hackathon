/**
 * Portable campaign planning contract for MARI Growth Intelligence.
 * No network calls, credentials, UI dependencies or fabricated results.
 * Replace the deterministic composer with a Meta-model-backed adapter later.
 */
export function buildCampaignPlan(proposal) {
  if (!proposal?.id || !proposal?.business || !proposal?.strategy) throw new Error('Valid proposal required');
  const { business, strategy } = proposal;
  const target = String(business.audience || 'prospective customers').slice(0, 150);
  const name = String(business.name).slice(0, 100);
  const objective = String(business.objective).slice(0, 300);
  const message = String(strategy.action).slice(0, 500);
  const createdAt = proposal.createdAt;
  return {
    schemaVersion: '1.0',
    proposalId: proposal.id,
    sourceProvider: proposal.provider,
    createdAt,
    status: 'DRAFT_REQUIRES_REVIEW',
    execution: 'NOT_PUBLISHED',
    campaign: {
      title: `${name} — Growth Experiment`,
      objective,
      targetAudience: target,
      hypothesis: `A relevant, permissioned campaign for ${target} may help progress toward the stated goal. Outcomes are unknown until measured.`,
      measurementPlan: { primaryMetric: strategy.successMetric, baseline: null, actualResult: null, status: 'NOT_MEASURED' }
    },
    channels: [
      { platform: 'facebook', format: 'FEED', headline: `Discover ${name}`, message, cta: 'Learn More', status: 'DRAFT', mediaAsset: null },
      { platform: 'instagram', format: 'STORY_OR_REEL', headline: `Meet ${name}`, message, cta: 'Explore', status: 'DRAFT', mediaAsset: null }
    ],
    creativeBrief: {
      brandName: name,
      targetAudience: target,
      objective,
      creativeDirection: `Develop a visual concept for ${target} that clearly reflects the business offering. Verify actual branding before generation.`,
      sourceBrandAssets: [],
      reviewRequired: true,
      generatedAsset: null
    },
    provenance: {
      businessInformation: 'USER_SUPPLIED',
      recommendation: proposal.provider,
      audienceEvidence: 'NOT_VERIFIED',
      creativeEvidence: 'NOT_GENERATED',
      performanceEvidence: 'NOT_AVAILABLE'
    }
  };
}
