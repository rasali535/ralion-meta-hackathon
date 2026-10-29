/**
 * Deterministic channel-draft builder for Growth and Social.
 * Pure and dependency-free. Derives Facebook- and Instagram-shaped drafts
 * from mission content only: business identity, objective, audience, and
 * the deterministic growth plan. Every draft carries explicit grounding so
 * the UI can separate mission-derived suggestions from verified facts.
 * Never invents metrics, results, or publishing outcomes.
 */
export const SOCIAL_COPY_LIMITS=Object.freeze({facebookCaption:500,instagramCaption:300,cta:120,maxHashtags:5});
const FACT_TAGS=Object.freeze(['business.name','business.objective','business.audience']);

function clean(value,max){
  return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
}
function words(value){
  return String(value||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2);
}
export function hashtagsFor(industry,name,max=SOCIAL_COPY_LIMITS.maxHashtags){
  const seen=new Set();
  const tags=[];
  for(const w of [...words(industry),...words(name)]){
    const tag='#'+w;
    if(seen.has(tag))continue;
    seen.add(tag);
    tags.push(tag);
    if(tags.length>=max)break;
  }
  return tags;
}
export function buildChannelDrafts(mission, options = {}){
  if(!mission||typeof mission!=='object')throw new Error('SOCIAL_MISSION_REQUIRED');
  const business=mission.business&&typeof mission.business==='object'?mission.business:{};
  const name=clean(business.name,100);
  const objective=clean(business.objective,300);
  const audience=clean(business.audience,200);
  if(!name||!objective)throw new Error('SOCIAL_BUSINESS_REQUIRED');
  const opportunity=clean(mission.growth&&mission.growth.opportunity,300);
  const lessons = options?.lessons || options?.memory || null;
  const approvedCount = Number(lessons?.approvedCount || 0);
  const memoryLabel = approvedCount > 0
    ? 'Shaped by ' + approvedCount + ' approved draft(s) in this workspace'
    : 'No previous decision memory in this workspace — using baseline starter template';
  const grounding={source:'MISSION_DRAFT_DERIVED',facts:[...FACT_TAGS],memory:memoryLabel};
  const facebookCaption=clean(
    'Discover '+name+' — '+objective+'. '+(opportunity?opportunity+' ':'')+'Draft concept for review; nothing is published.',
    SOCIAL_COPY_LIMITS.facebookCaption);
  const instagramCaption=clean(
    'Meet '+name+'. '+objective+'.',
    SOCIAL_COPY_LIMITS.instagramCaption);
  return [
    {channel:'Facebook',caption:facebookCaption,cta:clean('Learn more about '+name,120),audience:audience||'Potential customers',hashtags:[],grounding,status:'DRAFT_ONLY'},
    {channel:'Instagram',caption:instagramCaption,cta:clean('Explore '+name,120),audience:audience||'Potential customers',hashtags:hashtagsFor(business.industry,name),grounding:{...grounding,facts:[...FACT_TAGS]},status:'DRAFT_ONLY'},
  ];
}
