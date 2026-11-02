/**
 * Tenant brand kit: the business knowledge MARI writes and designs with.
 * Pure and dependency-free (no node imports) so mission planning (server)
 * and draft builders (server + browser) share it. A brand kit is explicit
 * business context, never a measured claim: tagline, voice tone, hashtags,
 * CTA style, and brand colors. Sanitization is total: missing or hostile
 * input always yields the safe baseline kit, never an exception.
 */
export const BRAND_TONES=Object.freeze(['friendly','professional','playful','bold']);
export const BRAND_LIMITS=Object.freeze({tagline:120,ctaStyle:120,hashtags:5,tagLength:30});
export const BRAND_DEFAULT_COLORS=Object.freeze({primary:'#1F2937',accent:'#0EA5A6'});

function clean(value,max){
  return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
}
function cleanColor(value,fallback){
  const c=String(value||'').trim();
  return /^#[0-9a-f]{6}$/i.test(c)?c.toUpperCase():fallback;
}
function cleanTag(raw){
  const t=String(raw||'').trim().replace(/^#+/,'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,BRAND_LIMITS.tagLength);
  return t?'#'+t:'';
}
export function sanitizeHashtags(raw){
  const list=Array.isArray(raw)?raw:String(raw||'').split(/[,\s]+/);
  const seen=new Set();
  const out=[];
  for(const item of list){
    const tag=cleanTag(item);
    if(!tag||seen.has(tag))continue;
    seen.add(tag);
    out.push(tag);
    if(out.length>=BRAND_LIMITS.hashtags)break;
  }
  return out;
}
export function sanitizeBrandKit(raw){
  const b=raw&&typeof raw==='object'?raw:{};
  const tone=String(b.tone||'').trim().toLowerCase();
  return {
    tagline:clean(b.tagline,BRAND_LIMITS.tagline),
    tone:BRAND_TONES.includes(tone)?tone:'friendly',
    hashtags:sanitizeHashtags(b.hashtags),
    primaryColor:cleanColor(b.primaryColor,BRAND_DEFAULT_COLORS.primary),
    accentColor:cleanColor(b.accentColor,BRAND_DEFAULT_COLORS.accent),
    ctaStyle:clean(b.ctaStyle,BRAND_LIMITS.ctaStyle),
  };
}
export function isDefaultBrandKit(kit){
  const k=sanitizeBrandKit(kit);
  return !k.tagline&&k.tone==='friendly'&&k.hashtags.length===0&&!k.ctaStyle
    &&k.primaryColor===BRAND_DEFAULT_COLORS.primary&&k.accentColor===BRAND_DEFAULT_COLORS.accent;
}
export function brandKitLabel(kit){
  const k=sanitizeBrandKit(kit);
  if(isDefaultBrandKit(k))return 'Baseline voice — no brand kit set';
  const bits=[k.tone+' voice'];
  if(k.tagline)bits.push('tagline set');
  if(k.hashtags.length>0)bits.push(k.hashtags.length+' custom hashtag(s)');
  if(k.ctaStyle)bits.push('custom CTA');
  if(k.primaryColor!==BRAND_DEFAULT_COLORS.primary||k.accentColor!==BRAND_DEFAULT_COLORS.accent)bits.push('custom colors');
  return 'On-brand: '+bits.join(' · ');
}
