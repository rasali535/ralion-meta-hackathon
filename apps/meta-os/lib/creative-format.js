/**
 * Clean-room creative format table for Creative Studio.
 * Pure and dependency-free: imported by the browser form, the prompt
 * builder, and the generation route. Dimensions follow the production
 * SOCIAL_DIMENSIONS convention (1:1, 4:5, 9:16) without importing
 * production code.
 * Honesty boundary: these are REQUESTED formats recorded with the asset.
 * The image adapter sends no size parameters, and native Muse Image size
 * support has not been live-verified (no billable calls permitted), so
 * the UI must present these as requested — never as guaranteed output.
 */
export const CREATIVE_FORMATS=Object.freeze([
  Object.freeze({id:'square',label:'1:1 Square',width:1080,height:1080,channels:Object.freeze(['instagram','facebook'])}),
  Object.freeze({id:'portrait',label:'4:5 Portrait',width:1080,height:1350,channels:Object.freeze(['instagram','facebook'])}),
  Object.freeze({id:'story',label:'9:16 Story',width:1080,height:1920,channels:Object.freeze(['instagram','facebook'])}),
]);
export const DEFAULT_CREATIVE_FORMAT='square';

export function resolveCreativeFormat(id){
  const key=String(id||'').trim().toLowerCase()||DEFAULT_CREATIVE_FORMAT;
  const hit=CREATIVE_FORMATS.find(f=>f.id===key);
  if(!hit)throw new Error('CREATIVE_FORMAT_INVALID');
  return hit;
}
export function formatPromptPhrase(format){
  const f=typeof format==='string'?resolveCreativeFormat(format):format;
  if(!f||typeof f!=='object'||!f.id)throw new Error('CREATIVE_FORMAT_INVALID');
  const resolved=resolveCreativeFormat(f.id);
  return 'Compose for a '+resolved.label+' frame ('+resolved.width+' by '+resolved.height+')';
}
export function formatAspect(format){
  const f=typeof format==='string'?resolveCreativeFormat(format):format;
  const resolved=resolveCreativeFormat(f&&f.id);
  return resolved.width+' / '+resolved.height;
}
