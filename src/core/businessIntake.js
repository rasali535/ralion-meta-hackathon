/** Portable business-context intake. No server-side URL fetching or production data access. */
export function intakeBusinessContext(input = {}) {
 const website = String(input.website ?? '').trim();
 if (website) {
  let url;
  try { url = new URL(website); } catch { throw new Error('Website must be a valid HTTPS URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || website.length > 500) throw new Error('Website must be a valid HTTPS URL');
 }
 const facts = String(input.facts ?? '').trim().slice(0,4000);
 return {
  schemaVersion:'1.0',websiteUrl:website || null,
  websiteFetched:false, websiteEvidence:null,
  userProvidedFacts:facts || null,
  evidenceSource:facts ? 'USER_SUPPLIED_UNVERIFIED' : 'NOT_PROVIDED',
  collectedAt:new Date().toISOString(),
  status: website ? 'WEBSITE_NOT_YET_ANALYZED' : 'MANUAL_CONTEXT_ONLY'
 };
}
export function analysisEvidence(business, metrics, context){
 return { business, metrics, metricsSource: metrics ? 'USER_SUPPLIED_UNVERIFIED' : 'NO_METRICS_PROVIDED',
  context: { websiteUrl:context.websiteUrl,websiteFetched:false,userProvidedFacts:context.userProvidedFacts,evidenceSource:context.evidenceSource }};
}
