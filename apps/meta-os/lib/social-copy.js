/**
 * Deterministic channel-draft builder for Growth and Social.
 * Pure and dependency-free. Derives Facebook- and Instagram-shaped drafts
 * from mission content only: business identity, objective, audience, the
 * deterministic growth plan, and the tenant brand kit (voice tone, tagline,
 * hashtags, CTA style). Every draft carries explicit grounding so the UI
 * can separate mission-derived suggestions from verified facts.
 * Never invents metrics, results, or publishing outcomes.
 */
import {sanitizeBrandKit,brandKitLabel} from './brand.js';

export const SOCIAL_COPY_LIMITS=Object.freeze({facebookCaption:500,instagramCaption:300,cta:120,maxHashtags:5});
const FACT_TAGS=Object.freeze(['business.name','business.objective','business.audience']);
const TONE_OPENERS=Object.freeze({
  friendly:{facebook:'Discover ',instagram:'Meet '},
  professional:{facebook:'Introducing ',instagram:'Introducing '},
  playful:{facebook:'Say hello to ',instagram:'Fresh from '},
  bold:{facebook:'',instagram:''}
});

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
  const brand=sanitizeBrandKit(mission.brand);
  const opener=TONE_OPENERS[brand.tone]||TONE_OPENERS.friendly;
  const tag=brand.tagline?' "'+brand.tagline+'"':'';
  const customTags=brand.hashtags;
  const grounding={source:'MISSION_DRAFT_DERIVED',facts:[...FACT_TAGS],memory:memoryLabel,brand:brandKitLabel(brand)};
  const facebookCaption=clean(
    opener.facebook+name+tag+' — '+objective+'. '+(opportunity?opportunity+' ':'')+'Draft concept for review; nothing is published.',
    SOCIAL_COPY_LIMITS.facebookCaption);
  const instagramCaption=clean(
    opener.instagram+name+'.'+tag+' '+objective+'.',
    SOCIAL_COPY_LIMITS.instagramCaption);
  const customCta=brand.ctaStyle||null;
  return [
    {channel:'Facebook',caption:facebookCaption,cta:customCta||clean('Learn more about '+name,120),audience:audience||'Potential customers',hashtags:customTags.length>0?[...customTags]:[],grounding,status:'DRAFT_ONLY'},
    {channel:'Instagram',caption:instagramCaption,cta:customCta||clean('Explore '+name,120),audience:audience||'Potential customers',hashtags:customTags.length>0?[...customTags]:hashtagsFor(business.industry,name),grounding:{...grounding,facts:[...FACT_TAGS]},status:'DRAFT_ONLY'},
  ];
}
