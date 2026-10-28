/**
 * Short-lived signed URLs for creative asset delivery.
 * <img> tags cannot send auth headers, so delivery uses single-asset,
 * tenant-bound, expiring HMAC capabilities instead of demo tokens.
 * Server-only: signing needs the secret; never import from client code.
 */
import {timingSafeEqual,createHmac} from 'node:crypto';

export const ASSET_URL_TTL_MS=15*60*1000;
export const ASSET_URL_MAX_TTL_MS=24*60*60*1000;
const SEGMENT_RE=/^[a-z0-9][a-z0-9-_]{0,63}$/i;
const ASSET_RE=/^img_[0-9a-f]{16}$/;

function safeEqual(a,b){
  const ab=Buffer.from(String(a||''),'utf8');
  const bb=Buffer.from(String(b||''),'utf8');
  if(ab.length!==bb.length||ab.length===0)return false;
  return timingSafeEqual(ab,bb);
}
function tenantParts(organizationId,workspaceId,assetId){
  const org=String(organizationId||'');
  const ws=String(workspaceId||'');
  const id=String(assetId||'');
  if(!SEGMENT_RE.test(org))throw new Error('ASSET_ORG_INVALID');
  if(!SEGMENT_RE.test(ws))throw new Error('ASSET_WORKSPACE_INVALID');
  if(!ASSET_RE.test(id))throw new Error('ASSET_ID_INVALID');
  return {org,ws,id};
}
export function signAssetUrl({organizationId,workspaceId,assetId,hmacSecret,ttlMs=ASSET_URL_TTL_MS,now=Date.now()}){
  const {org,ws,id}=tenantParts(organizationId,workspaceId,assetId);
  if(!hmacSecret)throw new Error('ASSET_SECRET_REQUIRED');
  const ttl=Math.max(60*1000,Math.min(ASSET_URL_MAX_TTL_MS,Number(ttlMs)||0));
  const exp=Number(now)+ttl;
  const body=['asset',org,ws,id,exp].join('.');
  const sig=createHmac('sha256',String(hmacSecret)).update(body,'utf8').digest('hex');
  return {exp:String(exp),sig,url:'/api/creative/asset?id='+encodeURIComponent(id)+'&org='+encodeURIComponent(org)+'&ws='+encodeURIComponent(ws)+'&exp='+exp+'&sig='+sig};
}
export function verifyAssetUrl({id,org,ws,exp,sig,hmacSecret,now=Date.now()}){
  const parts=tenantParts(org,ws,id);
  if(!hmacSecret)throw new Error('ASSET_SECRET_REQUIRED');
  if(!/^\d{1,15}$/.test(String(exp||'')))throw new Error('ASSET_URL_INVALID');
  if(!/^[0-9a-f]{64}$/.test(String(sig||'')))throw new Error('ASSET_URL_INVALID');
  const expMs=Number(exp);
  const nowMs=Number(now);
  if(expMs<=nowMs)throw new Error('ASSET_URL_EXPIRED');
  if(expMs-nowMs>ASSET_URL_MAX_TTL_MS)throw new Error('ASSET_URL_INVALID');
  const expected=createHmac('sha256',String(hmacSecret)).update(['asset',parts.org,parts.ws,parts.id,exp].join('.'),'utf8').digest('hex');
  if(!safeEqual(sig,expected))throw new Error('ASSET_URL_INVALID');
  return {organizationId:parts.org,workspaceId:parts.ws,assetId:parts.id};
}
