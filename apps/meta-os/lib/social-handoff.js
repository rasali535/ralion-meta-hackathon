/**
 * Canonical social handoff contracts for Facebook and Instagram drafts.
 * Pure and dependency-free: imported by the approve route (server) and the
 * Social/Activity views (browser). Mirrors the production
 * SocialHandoffContract shape (asset + tenant + channel copy + campaign)
 * without any publishing capability: every contract carries
 * publishStatus NOT_CONNECTED and status DRAFT_ONLY.
 * Preview references are validated asset pointers, never URLs: expiring
 * signed preview URLs must never serve as permanent media references.
 */
export const SOCIAL_HANDOFF_VERSION='1.0';
export const SOCIAL_HANDOFF_CHANNELS=Object.freeze(['facebook','instagram']);
export const SOCIAL_HANDOFF_LIMITS=Object.freeze({title:120,caption:500,cta:120,campaign:120,audience:200,hashtags:5});

const SEGMENT_RE=/^[a-z0-9][a-z0-9-_]{0,63}$/i;
const ASSET_RE=/^img_[0-9a-f]{16}$/;

function clean(value,max){
  return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
}
function assertSegment(value,code){
  const s=String(value||'').trim();
  if(!SEGMENT_RE.test(s))throw new Error(code);
  return s;
}
export function normalizeChannel(channel){
  const c=String(channel||'').trim().toLowerCase();
  if(!SOCIAL_HANDOFF_CHANNELS.includes(c))throw new Error('SOCIAL_HANDOFF_CHANNEL_INVALID');
  return c;
}
function assertAssetRef(asset,tenant){
  if(asset===null||asset===undefined)return null;
  if(!asset||typeof asset!=='object')throw new Error('SOCIAL_HANDOFF_ASSET_INVALID');
  const id=String(asset.assetId||'');
  if(!ASSET_RE.test(id))throw new Error('SOCIAL_HANDOFF_ASSET_INVALID');
  if(String(asset.organizationId||'')!==tenant.organizationId||String(asset.workspaceId||'')!==tenant.workspaceId)throw new Error('SOCIAL_HANDOFF_ASSET_TENANT_MISMATCH');
  return {assetId:id,mediaType:'image'};
}
export function buildSocialHandoff({draft,tenant,missionId,campaign,asset=null,approval=null}={}){
  if(!draft||typeof draft!=='object')throw new Error('SOCIAL_HANDOFF_DRAFT_REQUIRED');
  const org=assertSegment(tenant&&tenant.organizationId,'SOCIAL_HANDOFF_TENANT_REQUIRED');
  const ws=assertSegment(tenant&&tenant.workspaceId,'SOCIAL_HANDOFF_TENANT_REQUIRED');
  const mid=String(missionId||'').trim().slice(0,100);
  if(!mid)throw new Error('SOCIAL_HANDOFF_MISSION_REQUIRED');
  const channel=normalizeChannel(draft.channel);
  const caption=clean(draft.caption||draft.copy,SOCIAL_HANDOFF_LIMITS.caption);
  if(!caption)throw new Error('SOCIAL_HANDOFF_CAPTION_REQUIRED');
  const ref=assertAssetRef(asset,{organizationId:org,workspaceId:ws});
  return {
    schemaVersion:SOCIAL_HANDOFF_VERSION,
    channel,
    organizationId:org,
    workspaceId:ws,
    missionId:mid,
    assetId:ref?ref.assetId:null,
    mediaType:ref?ref.mediaType:null,
    previewRef:ref?{kind:'signed-asset-delivery',assetId:ref.assetId}:null,
    title:clean(draft.title||(channel==='facebook'?'Facebook campaign draft':'Instagram campaign draft'),SOCIAL_HANDOFF_LIMITS.title),
    caption,
    cta:clean(draft.cta,SOCIAL_HANDOFF_LIMITS.cta),
    campaign:clean(campaign,SOCIAL_HANDOFF_LIMITS.campaign),
    audience:clean(draft.audience,SOCIAL_HANDOFF_LIMITS.audience),
    hashtags:Array.isArray(draft.hashtags)?draft.hashtags.filter(h=>typeof h==='string').map(h=>h.slice(0,60)).slice(0,SOCIAL_HANDOFF_LIMITS.hashtags):[],
    status:'DRAFT_ONLY',
    publishStatus:'NOT_CONNECTED',
    approval:approval?snapshotApproval(approval,{organizationId:org,workspaceId:ws,missionId:mid}):null,
  };
}
export function snapshotApproval(record,{organizationId,workspaceId,missionId}={}){
  if(!record||typeof record!=='object')throw new Error('SOCIAL_HANDOFF_APPROVAL_INVALID');
  if(String(record.organizationId)!==String(organizationId)||String(record.workspaceId)!==String(workspaceId))throw new Error('SOCIAL_HANDOFF_APPROVAL_TENANT_MISMATCH');
  if(String(record.missionId)!==String(missionId))throw new Error('SOCIAL_HANDOFF_APPROVAL_MISSION_MISMATCH');
  if(String(record.scope)!=='LOCAL_DRAFT_ONLY')throw new Error('SOCIAL_HANDOFF_APPROVAL_SCOPE_UNAUTHORIZED');
  return {
    approvalId:String(record.approvalId||'').slice(0,80),
    decision:String(record.decision||'').slice(0,20),
    approvedBy:String((record.actor&&record.actor.id)||'').slice(0,120),
    role:String((record.actor&&record.actor.role)||'').slice(0,40),
    planHash:String(record.planHash||'').slice(0,128),
    approvedAt:String(record.approvedAt||'').slice(0,40),
  };
}
export function bindSocialHandoffApproval(handoff,record){
  if(!handoff||typeof handoff!=='object')throw new Error('SOCIAL_HANDOFF_INVALID');
  return {...handoff,approval:snapshotApproval(record,{organizationId:handoff.organizationId,workspaceId:handoff.workspaceId,missionId:handoff.missionId})};
}
export function verifySocialHandoffBinding(handoff,planHash){
  if(!handoff||typeof handoff!=='object'||!handoff.approval)return false;
  return String(handoff.approval.planHash||'')===String(planHash||'')&&String(handoff.approval.planHash||'').length>0;
}
export function defaultCampaignLabel(mission){
  const b=(mission&&mission.business)||{};
  const opp=mission&&mission.growth?mission.growth.opportunity:'';
  return clean(String(b.name||'')+(opp?' — '+opp:''),SOCIAL_HANDOFF_LIMITS.campaign);
}
export function attachSocialHandoffs(mission,{tenant,assets,approval=null,campaign}={}){
  if(!mission||typeof mission!=='object')throw new Error('SOCIAL_HANDOFF_MISSION_INVALID');
  assertSegment(tenant&&tenant.organizationId,'SOCIAL_HANDOFF_TENANT_REQUIRED');
  assertSegment(tenant&&tenant.workspaceId,'SOCIAL_HANDOFF_TENANT_REQUIRED');
  const list=Array.isArray(assets)?assets.filter(a=>a&&typeof a==='object'):[];
  const primary=list[0]||null;
  const label=campaign!==undefined?clean(campaign,SOCIAL_HANDOFF_LIMITS.campaign):defaultCampaignLabel(mission);
  const social=Array.isArray(mission.social)?mission.social.map(draft=>{
    try{
      return {...draft,socialContract:buildSocialHandoff({draft,tenant,missionId:mission.missionId,campaign:label,asset:primary,approval})};
    }catch{
      return {...draft,socialContract:null};
    }
  }):[];
  return {...mission,social};
}
