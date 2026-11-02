/**
 * Sandbox dispatch outbox for approved campaign drafts. Server-only.
 * Layout: <root>/<org>/<workspace>/<dispatchId>.json (export manifest only).
 *
 * A dispatch receipt is the smallest honest "act" this build can perform:
 * it packages an APPROVED mission's exact bytes (asset manifest + channel
 * copy, referenced by id and SHA-256, never re-hosted) into a signed,
 * tenant-isolated export bundle. Dispatching never publishes, schedules,
 * spends, or contacts any external API: every receipt carries execution
 * SANDBOX_EXPORT_ONLY and publishStatus NOT_CONNECTED.
 *
 * Verification reuses the approval trust root: the caller submits the
 * mission plus the full server-minted approval record, and the plan hash
 * binding rejects any post-approval edit. Dispatches are idempotent per
 * approval: re-submitting the same approval returns the existing receipt.
 */
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {verifyApprovalRecord} from './approval.js';

export const DISPATCH_SCHEMA_VERSION='1.0';
export const DISPATCH_EXECUTION_STATUS='SANDBOX_EXPORT_ONLY';

const SEGMENT_RE=/^[a-z0-9][a-z0-9-_]{0,63}$/i;
const DISPATCH_RE=/^dsp_[0-9a-f]{16}$/;

export function dispatchConfig(env=process.env){
  const dir=typeof env.DISPATCH_STORAGE_DIR==='string'&&env.DISPATCH_STORAGE_DIR?env.DISPATCH_STORAGE_DIR:(env.VERCEL?'/tmp/ralion-dispatch':'.data/dispatch');
  return {storageDir:dir};
}
export function mintDispatchId(){return 'dsp_'+randomBytes(8).toString('hex');}
function assertSegment(v,code){const s=String(v||'');if(!SEGMENT_RE.test(s))throw new Error(code);return s;}
function assertRoot(root){
  const s=String(root||'').trim();
  if(!s)throw new Error('DISPATCH_STORAGE_INVALID');
  const r=resolve(s);
  if(!r||r===sep)throw new Error('DISPATCH_STORAGE_INVALID');
  return r;
}
export function dispatchPaths(root,organizationId,workspaceId,dispatchId){
  const base=assertRoot(root);
  const org=assertSegment(organizationId,'DISPATCH_ORG_INVALID');
  const ws=assertSegment(workspaceId,'DISPATCH_WORKSPACE_INVALID');
  const id=String(dispatchId||'');
  if(!DISPATCH_RE.test(id))throw new Error('DISPATCH_ID_INVALID');
  const dir=join(base,org,ws);
  const meta=resolve(dir,id+'.json');
  if(!meta.startsWith(base+sep))throw new Error('DISPATCH_PATH_ESCAPE');
  return {dir,meta};
}
function clean(value,max){
  return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
}
function manifestAssets(mission){
  const assets=mission&&mission.creative&&Array.isArray(mission.creative.assets)?mission.creative.assets:[];
  return assets.slice(0,24).map(a=>({
    assetId:clean(a&&a.assetId,60),
    prompt:clean(a&&a.prompt,300),
    mimeType:clean(a&&a.mimeType,40),
    bytes:Number.isFinite(Number(a&&a.bytes))?Number(a.bytes):null,
    sha256:clean(a&&a.sha256,128),
  }));
}
function manifestChannels(mission){
  const social=mission&&Array.isArray(mission.social)?mission.social:[];
  return social.slice(0,12).map(s=>({
    channel:clean(s&&s.channel,40),
    caption:clean(s&&(s.caption||s.copy),500),
    cta:clean(s&&s.cta,120),
    hashtags:Array.isArray(s&&s.hashtags)?s.hashtags.filter(h=>typeof h==='string').map(h=>h.slice(0,60)).slice(0,5):[],
  }));
}
function canonicalBundle({missionId,organizationId,workspaceId,planHash,assets,channels}){
  return {missionId,organizationId,workspaceId,planHash,assets,channels};
}
function sha256Hex(text){return createHash('sha256').update(text,'utf8').digest('hex');}
function sigPayload({dispatchId,missionId,planHash,bundleHash,dispatchedAt}){
  return `${dispatchId}:${missionId}:${planHash}:${bundleHash}:${dispatchedAt}`;
}
export function buildDispatchReceipt({mission,approval,tenant,hmacSecret,now}={}){
  if(!mission||typeof mission!=='object')throw new Error('DISPATCH_MISSION_REQUIRED');
  const mid=String(mission.missionId||'').trim().slice(0,100);
  if(!mid)throw new Error('DISPATCH_MISSION_REQUIRED');
  const org=assertSegment(tenant&&tenant.organizationId,'DISPATCH_TENANT_REQUIRED');
  const ws=assertSegment(tenant&&tenant.workspaceId,'DISPATCH_TENANT_REQUIRED');
  if(!approval||typeof approval!=='object')throw new Error('DISPATCH_APPROVAL_REQUIRED');
  if(String(approval.decision)!=='APPROVED')throw new Error('DISPATCH_DECISION_NOT_APPROVED');
  if(String(approval.scope)!=='LOCAL_DRAFT_ONLY')throw new Error('DISPATCH_SCOPE_UNAUTHORIZED');
  if(String(approval.organizationId)!==org||String(approval.workspaceId)!==ws)throw new Error('DISPATCH_APPROVAL_TENANT_MISMATCH');
  if(String(approval.missionId)!==mid)throw new Error('DISPATCH_APPROVAL_MISSION_MISMATCH');
  if(!hmacSecret)throw new Error('DISPATCH_SECRET_REQUIRED');
  let verified=false;
  try{verified=verifyApprovalRecord(approval,mission,{hmacSecret})===true;}
  catch{verified=false;}
  if(!verified)throw new Error('DISPATCH_PLAN_TAMPERED');
  const assets=manifestAssets(mission);
  const channels=manifestChannels(mission);
  const planHash=String(approval.planHash||'');
  const bundleHash=sha256Hex(JSON.stringify(canonicalBundle({missionId:mid,organizationId:org,workspaceId:ws,planHash,assets,channels})));
  const dispatchId=mintDispatchId();
  const dispatchedAt=new Date(now===undefined?Date.now():now).toISOString();
  const approvedMs=Date.parse(String(approval.approvedAt||''));
  const dispatchedMs=Date.parse(dispatchedAt);
  const approvalLatencyMs=Number.isFinite(approvedMs)&&Number.isFinite(dispatchedMs)?Math.max(0,dispatchedMs-approvedMs):null;
  const signature=createHmac('sha256',hmacSecret).update(sigPayload({dispatchId,missionId:mid,planHash,bundleHash,dispatchedAt}),'utf8').digest('hex');
  return Object.freeze({
    schemaVersion:DISPATCH_SCHEMA_VERSION,
    dispatchId,
    missionId:mid,
    organizationId:org,
    workspaceId:ws,
    approval:{
      approvalId:String(approval.approvalId||'').slice(0,80),
      approvedBy:String((approval.actor&&approval.actor.id)||'').slice(0,120),
      role:String((approval.actor&&approval.actor.role)||'').slice(0,40),
      planHash,
      approvedAt:String(approval.approvedAt||'').slice(0,40),
    },
    assets,
    channels,
    bundleHash,
    dispatchedAt,
    approvalLatencyMs,
    execution:DISPATCH_EXECUTION_STATUS,
    publishStatus:'NOT_CONNECTED',
    signature,
  });
}
export function verifyDispatchReceipt(receipt,{hmacSecret}={}){
  if(!receipt||typeof receipt!=='object')return false;
  if(!hmacSecret)return false;
  if(String(receipt.execution)!==DISPATCH_EXECUTION_STATUS)return false;
  if(String(receipt.publishStatus)!=='NOT_CONNECTED')return false;
  const expected=sha256Hex(JSON.stringify(canonicalBundle({
    missionId:String(receipt.missionId||''),
    organizationId:String(receipt.organizationId||''),
    workspaceId:String(receipt.workspaceId||''),
    planHash:String((receipt.approval&&receipt.approval.planHash)||''),
    assets:Array.isArray(receipt.assets)?receipt.assets:[],
    channels:Array.isArray(receipt.channels)?receipt.channels:[],
  })));
  if(String(receipt.bundleHash||'')!==expected)return false;
  const expectedSig=createHmac('sha256',hmacSecret).update(sigPayload({
    dispatchId:String(receipt.dispatchId||''),
    missionId:String(receipt.missionId||''),
    planHash:String((receipt.approval&&receipt.approval.planHash)||''),
    bundleHash:expected,
    dispatchedAt:String(receipt.dispatchedAt||''),
  }),'utf8').digest('hex');
  const a=Buffer.from(String(receipt.signature||''),'utf8');
  const b=Buffer.from(expectedSig,'utf8');
  if(a.length!==b.length||a.length===0)return false;
  return timingSafeEqual(a,b);
}
export function saveDispatchReceipt(root,{organizationId,workspaceId,receipt}={}){
  if(!receipt||typeof receipt!=='object')throw new Error('DISPATCH_RECEIPT_INVALID');
  const {dir,meta}=dispatchPaths(root,organizationId,workspaceId,receipt.dispatchId);
  if(String(receipt.organizationId)!==String(organizationId)||String(receipt.workspaceId)!==String(workspaceId))throw new Error('DISPATCH_TENANT_MISMATCH');
  mkdirSync(dir,{recursive:true});
  writeFileSync(meta,JSON.stringify(receipt));
  return {dispatchId:String(receipt.dispatchId)};
}
export function loadDispatchReceipt(root,{organizationId,workspaceId,dispatchId}={}){
  const {meta}=dispatchPaths(root,organizationId,workspaceId,dispatchId);
  let receipt;
  try{receipt=JSON.parse(readFileSync(meta,'utf8'));}
  catch{throw new Error('DISPATCH_RECEIPT_MISSING');}
  if(!receipt||typeof receipt!=='object')throw new Error('DISPATCH_RECEIPT_MISSING');
  if(String(receipt.organizationId)!==String(organizationId)||String(receipt.workspaceId)!==String(workspaceId)||String(receipt.dispatchId)!==String(dispatchId))throw new Error('DISPATCH_TENANT_MISMATCH');
  return receipt;
}
export function listDispatchReceipts(root,{organizationId,workspaceId}={}){
  const base=assertRoot(root);
  const org=assertSegment(organizationId,'DISPATCH_ORG_INVALID');
  const ws=assertSegment(workspaceId,'DISPATCH_WORKSPACE_INVALID');
  const dir=join(base,org,ws);
  let names;
  try{names=readdirSync(dir);}catch{return [];}
  const out=[];
  for(const n of names){
    if(!n.endsWith('.json'))continue;
    const id=n.slice(0,-5);
    if(!DISPATCH_RE.test(id))continue;
    try{
      const r=JSON.parse(readFileSync(join(dir,n),'utf8'));
      if(r&&typeof r==='object'&&String(r.organizationId)===org&&String(r.workspaceId)===ws&&String(r.dispatchId)===id)out.push(r);
    }catch{}
  }
  out.sort((a,b)=>String(a.dispatchedAt||'').localeCompare(String(b.dispatchedAt||'')));
  return out;
}
export function findReceiptForApproval(root,{organizationId,workspaceId,approvalId}={}){
  const id=String(approvalId||'');
  if(!id)return null;
  const all=listDispatchReceipts(root,{organizationId,workspaceId});
  return all.find(r=>r&&r.approval&&String(r.approval.approvalId)===id)||null;
}
