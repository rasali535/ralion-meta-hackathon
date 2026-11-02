/**
 * Simulated Facebook/Instagram post models for the Social review mock.
 * Pure and dependency-free (no node imports) so views can use it directly.
 * A mock post shows layout only: page identity, caption, hashtags, CTA,
 * and the attached draft creative. It is never publishing and never
 * evidence of performance: every model carries simulated:true,
 * published:false, engagement:null, and the SIMULATED PREVIEW +
 * NOT PUBLISHED badges. Engagement words must never appear — enforced
 * by tests over the serialized model.
 */
import {sanitizeBrandKit,BRAND_DEFAULT_COLORS} from './brand.js';

export const MOCK_PLATFORMS=Object.freeze(['facebook','instagram']);
export const MOCK_LIMITS=Object.freeze({caption:500,cta:120,handle:30,name:100});

function clean(value,max){
  return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
}
function handleFor(name){
  const slug=String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,MOCK_LIMITS.handle);
  return '@'+(slug||'business');
}
export function normalizeMockPlatform(platform){
  const p=String(platform||'').trim().toLowerCase();
  if(!MOCK_PLATFORMS.includes(p))throw new Error('MOCK_PLATFORM_INVALID');
  return p;
}
export function buildMockPost(opts={}){
  const {draft,platform,businessName,brand,assetId}=opts&&typeof opts==='object'?opts:{};
  if(!draft||typeof draft!=='object')throw new Error('MOCK_DRAFT_REQUIRED');
  const feed=normalizeMockPlatform(platform);
  const kit=sanitizeBrandKit(brand);
  const caption=clean(draft.caption||draft.copy,MOCK_LIMITS.caption);
  const tags=Array.isArray(draft.hashtags)?draft.hashtags.filter(h=>typeof h==='string').map(h=>h.slice(0,60)).slice(0,5):[];
  return {
    platform:feed,
    simulated:true,
    published:false,
    engagement:null,
    badges:Object.freeze(['SIMULATED PREVIEW','NOT PUBLISHED']),
    pageName:clean(businessName,MOCK_LIMITS.name)||'Demo business',
    handle:handleFor(businessName),
    caption,
    hashtags:tags,
    ctaLabel:clean(draft.cta,MOCK_LIMITS.cta),
    accentColor:kit.accentColor,
    brandTone:kit.tone,
    assetId:typeof assetId==='string'&&assetId?assetId.slice(0,80):null,
  };
}
export function defaultAccentColor(){
  return BRAND_DEFAULT_COLORS.accent;
}
