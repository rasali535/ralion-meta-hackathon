/** Portable mission planning, deterministic demo adapter only. No external action or generated results. */
import {verifyApprovalRecord,recordHumanApproval} from './approval.js';
import {loadCreativeAsset} from './creative-store.js';
import {buildChannelDrafts} from './social-copy.js';
export const MISSION_SCHEMA_VERSION='1.2';
export function missionInput(input){
  const name=String(input?.name||input?.businessName||'').trim().slice(0,100);
  const industry=String(input?.industry||'').trim().slice(0,100);
  const objective=String(input?.objective||input?.goal||'').trim().slice(0,300);
  const audience=String(input?.audience||'Potential customers').trim().slice(0,200);
  const facts=String(input?.facts||'').trim().slice(0,2000);
  const website=String(input?.website||input?.websiteUrl||'').trim().slice(0,500);
  if(!name||!industry||!objective)throw Error('Business name, industry and objective are required');
  if(website){let u;try{u=new URL(website)}catch{throw Error('Enter a valid HTTPS business website')}if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))throw Error('Enter a valid HTTPS business website')}
  return {name,industry,objective,audience,facts,website};
}
function clampInt(v,min,max,fallback){
  const n=Number(v);
  if(!Number.isFinite(n))return fallback;
  return Math.max(min,Math.min(max,Math.floor(n)));
}
function sanitizeEvidence(e){
  if(!e||typeof e!=='object')return null;
  const excerpt=String(e.excerpt||'').slice(0,2000);
  if(!excerpt)return null;
  const url=v=>String(v||'').slice(0,1000);
  const citations=Array.isArray(e.citations)?e.citations.filter(c=>typeof c==='string').map(c=>c.slice(0,1000)).slice(0,8):[];
  const hash=String(e.contentHash||'');
  return {sourceUrl:url(e.sourceUrl),finalUrl:url(e.finalUrl),fetchedAt:String(e.fetchedAt||'').slice(0,40),title:String(e.title||'').slice(0,200),description:String(e.description||'').slice(0,500),excerpt,textChars:clampInt(e.textChars,0,10000000,excerpt.length),wordCount:clampInt(e.wordCount,0,1000000,0),contentHash:/^sha256:[0-9a-f]{64}$/.test(hash)?hash:'UNVERIFIED',citations,redirectHops:clampInt(e.redirectHops,0,10,0)};
}
function sanitizeFailure(code){
  const c=String(code||'');
  if(!c)return null;
  return /^WEBSITE_[A-Z0-9_]{1,60}$/.test(c)?c:'UNKNOWN';
}
export function planMission(input,options={}){
  const f=missionInput(input);
  const opts=options&&typeof options==='object'?options:{};
  const site=sanitizeEvidence(opts.evidence);
  const failure=sanitizeFailure(opts.ingestError);
  const missionId=crypto.randomUUID();
  const base={name:f.name,industry:f.industry,objective:f.objective,audience:f.audience,facts:f.facts,website:f.website};
  const websiteStatus=site?(site.redirectHops>0?'RETRIEVED_WITH_REDIRECT':'RETRIEVED'):(failure?'RETRIEVAL_FAILED_'+failure:(f.website?'REFERENCE_ONLY_NOT_CRAWLED':'NOT_PROVIDED'));
  // category is a fixed template label for this single deterministic draft
  // type, matching the production growth taxonomy. It is structural, not a
  // measured confidence or classification result.
  const growth={category:'MARKETING_ACQUISITION',opportunity:'Test a focused campaign for '+f.audience,reason:'The supplied goal suggests testing customer acquisition; this is a hypothesis, not an observed business diagnosis.',objective:f.objective,measurement:'Track qualified enquiries or attributed visits after authorized execution',results:null};
  const social=buildChannelDrafts({business:base,growth}).map((d,i)=>({channel:d.channel,copy:i===0?'Discover '+f.name+' — '+f.objective+'.':'Meet '+f.name+'. Explore what makes us different.',caption:d.caption,cta:d.cta,audience:d.audience,hashtags:d.hashtags,grounding:d.grounding,status:'DRAFT_ONLY'}));
  return {schemaVersion:MISSION_SCHEMA_VERSION,missionId,createdAt:new Date().toISOString(),status:'AWAITING_HUMAN_REVIEW',provider:'DETERMINISTIC_DEMO_NOT_META_AI',business:base,
  evidence:{websiteRetrieved:!!site,websiteStatus,userFacts:f.facts?'USER_SUPPLIED_UNVERIFIED':'NOT_PROVIDED',campaignMetrics:'NOT_AVAILABLE',site},
  growth,
  creative:{brief:'Design an on-brand concept for '+f.name+' directed at '+f.audience+'. Verify actual brand assets before production.',assets:[],generated:false},
  social,
  approval:{status:'NOT_REQUESTED',actor:null},
  execution:{status:'NOT_CONNECTED',receipt:null},
  feedback:{status:'AWAITING_REAL_DATA',metrics:[]}
  };
}
export function attachApproval(mission,{record,expectedOrganizationId,expectedWorkspaceId,hmacSecret}={}){
  if(!mission||typeof mission!=='object')throw new Error('APPROVAL_INVALID_MISSION');
  if(!record||typeof record!=='object')throw new Error('APPROVAL_RECORD_INVALID');
  if(!hmacSecret)throw new Error('APPROVAL_SECRET_REQUIRED');
  const org=String(expectedOrganizationId||'').trim();
  const ws=String(expectedWorkspaceId||'').trim();
  if(!org||!ws)throw new Error('APPROVAL_TENANT_REQUIRED');
  if(String(record.organizationId||'')!==org||String(record.workspaceId||'')!==ws)throw new Error('APPROVAL_TENANT_MISMATCH');
  if(String(record.scope||'')!=='LOCAL_DRAFT_ONLY')throw new Error('APPROVAL_SCOPE_UNAUTHORIZED');
  let verified=false;
  try{verified=verifyApprovalRecord(record,mission,{hmacSecret})===true;}
  catch{verified=false;}
  if(!verified)throw new Error('APPROVAL_RECORD_INVALID');
  return {...mission,
    approval:{status:record.decision==='APPROVED'?'APPROVED':'REJECTED',actor:record.actor||null,scope:'LOCAL_DRAFT_ONLY',planHash:String(record.planHash||''),approvalId:String(record.approvalId||''),approvedAt:String(record.approvedAt||''),verified:true},
    execution:{status:'NOT_CONNECTED',receipt:null}};
}
export function mintMissionApproval(mission,{actorId,role,decision='APPROVED',scope='LOCAL_DRAFT_ONLY',notes='',organizationId,workspaceId,hmacSecret,storeRoot}={}){
  if(!mission||typeof mission!=='object')throw new Error('APPROVAL_INVALID_MISSION');
  missionInput(mission.business);
  const org=String(organizationId||'').trim();
  const ws=String(workspaceId||'').trim();
  if(!org||!ws)throw new Error('APPROVAL_TENANT_REQUIRED');
  const assets=Array.isArray(mission.creative?.assets)?mission.creative.assets:[];
  if(assets.length>0){
    if(!storeRoot)throw new Error('APPROVAL_STORAGE_REQUIRED');
    for(const a of assets){
      let stored;
      try{stored=loadCreativeAsset(storeRoot,{organizationId:org,workspaceId:ws,assetId:a&&a.assetId});}
      catch{throw new Error('APPROVAL_ASSET_UNKNOWN');}
      if(String(stored.metadata.prompt)!==String(a.prompt)||String(stored.metadata.sha256)!==String(a.sha256)||Number(stored.metadata.bytes)!==Number(a.bytes))throw new Error('APPROVAL_ASSET_MISMATCH');
    }
  }
  return recordHumanApproval(mission,{actorId,role,decision,scope,notes,organizationId:org,workspaceId:ws,hmacSecret});
}
