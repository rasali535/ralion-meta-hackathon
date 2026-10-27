/**
 * Demo-grade access control for paid Meta inference routes.
 * Server-only: never import from client components, never log tokens.
 *
 * Two credential types, both verified with timing-safe comparison:
 * - static integration token (META_REASONING_ACCESS_TOKEN) for restricted testing;
 * - stateless HMAC demo tokens (v1.<workspace>.<expiryMs>.<sig>) minted
 *   server-side with META_DEMO_TOKEN_SECRET. No issuance endpoint exists.
 * Rate-limit by tokenFingerprint(), never by raw token.
 */
import {timingSafeEqual,createHmac,createHash} from 'node:crypto';

export const DEMO_TOKEN_VERSION='v1';
export const DEMO_TOKEN_MAX_TTL_MS=90*24*60*60*1000;
export const DEMO_TOKEN_DEFAULT_TTL_MS=7*24*60*60*1000;
const WORKSPACE_RE=/^[a-z0-9][a-z0-9-_]{0,63}$/i;

function safeEqual(a,b){
  const ab=Buffer.from(String(a||''),'utf8');
  const bb=Buffer.from(String(b||''),'utf8');
  if(ab.length!==bb.length||ab.length===0)return false;
  return timingSafeEqual(ab,bb);
}
function signDemoToken(body,secret){
  return createHmac('sha256',secret).update(body,'utf8').digest('hex');
}
export function issueDemoToken(workspaceId,{hmacSecret,ttlMs=DEMO_TOKEN_DEFAULT_TTL_MS,now=Date.now()}={}){
  const ws=String(workspaceId||'');
  if(!WORKSPACE_RE.test(ws))throw new Error('DEMO_WORKSPACE_INVALID');
  if(!hmacSecret)throw new Error('AUTH_NOT_CONFIGURED');
  const ttl=Math.max(60*1000,Math.min(DEMO_TOKEN_MAX_TTL_MS,Number(ttlMs)||0));
  const exp=Number(now)+ttl;
  const body=DEMO_TOKEN_VERSION+'.'+ws+'.'+exp;
  return body+'.'+signDemoToken(body,String(hmacSecret));
}
export function verifyAccessToken(token,{staticToken,hmacSecret,now=Date.now()}={}){
  const t=String(token||'');
  if(!t||t.length>500)throw new Error('AUTH_INVALID');
  if(staticToken&&safeEqual(t,staticToken))return {workspaceId:'integration',via:'static'};
  if(!hmacSecret){
    if(staticToken)throw new Error('AUTH_INVALID');
    throw new Error('AUTH_NOT_CONFIGURED');
  }
  const parts=t.split('.');
  if(parts.length!==4||parts[0]!==DEMO_TOKEN_VERSION)throw new Error('AUTH_INVALID');
  const ws=parts[1];
  const exp=parts[2];
  const sig=parts[3];
  if(!WORKSPACE_RE.test(ws))throw new Error('AUTH_INVALID');
  if(!/^\d{1,15}$/.test(exp))throw new Error('AUTH_INVALID');
  if(!/^[0-9a-f]{64}$/.test(sig))throw new Error('AUTH_INVALID');
  const expMs=Number(exp);
  const nowMs=Number(now);
  if(expMs<=nowMs)throw new Error('AUTH_EXPIRED');
  if(expMs-nowMs>DEMO_TOKEN_MAX_TTL_MS)throw new Error('AUTH_INVALID');
  const expected=signDemoToken(parts[0]+'.'+ws+'.'+exp,String(hmacSecret));
  if(!safeEqual(sig,expected))throw new Error('AUTH_INVALID');
  return {workspaceId:ws,via:'demo'};
}
export function tokenFingerprint(token){
  return 'fp_'+createHash('sha256').update(String(token||''),'utf8').digest('hex').slice(0,16);
}
