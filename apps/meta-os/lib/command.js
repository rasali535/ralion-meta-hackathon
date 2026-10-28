/**
 * Pure Command Centre state derivation for the flagship dashboard.
 * No React, no browser APIs: safe for server import and unit tests.
 * Every helper derives from genuine application state (mission object,
 * tenant telemetry records, business form) and reports honest empty or
 * unavailable states. Nothing here invents metrics, usage, or results.
 */
export const REQUIRED_BUSINESS_FIELDS=Object.freeze(['name','industry','objective']);

export function missingBusinessFields(business){
  const b=business&&typeof business==='object'?business:{};
  return REQUIRED_BUSINESS_FIELDS.filter(f=>String(b[f]||'').trim().length===0);
}
export function telemetrySummary(records){
  const list=Array.isArray(records)?records:[];
  const byModel={};
  for(const r of list){
    if(!r||typeof r!=='object')continue;
    const m=String(r.model||'unknown');
    if(!byModel[m])byModel[m]={calls:0,failures:0,remainingUnits:null,lastAt:null};
    byModel[m].calls++;
    if(r.ok!==true)byModel[m].failures++;
    if(r.budget&&typeof r.budget.remainingUnits==='number')byModel[m].remainingUnits=r.budget.remainingUnits;
    if(r.timestamp)byModel[m].lastAt=r.timestamp;
  }
  return {total:list.length,byModel};
}
export function kpiFromMission(mission,records){
  const has=!!(mission&&typeof mission==='object');
  const assets=has&&mission.creative&&Array.isArray(mission.creative.assets)?mission.creative.assets.length:0;
  const approval=has?String(mission.approval&&mission.approval.status||'NOT_REQUESTED'):'NONE';
  const summary=telemetrySummary(records);
  const usageValue=records===null||records===undefined?'Unavailable':summary.total===0?'No calls':String(summary.total);
  return [
    {id:'missions',label:'Missions',value:has?'1':'0',sub:has?('Mission '+String(mission.missionId).slice(0,8)):'No mission yet',tone:has?'ok':'muted'},
    {id:'assets',label:'Creative assets',value:String(assets),sub:assets===0?'None generated':assets===1?'1 stored for review':assets+' stored for review',tone:assets>0?'ok':'muted'},
    {id:'approvals',label:'Pending approvals',value:approval==='APPROVED'||approval==='REJECTED'?'0':has?'1':'0',sub:approval==='APPROVED'?'Locally approved':approval==='REJECTED'?'Rejected — revise and resend':has?'Awaiting human review':'No mission yet',tone:approval==='APPROVED'?'ok':has?'warn':'muted'},
    {id:'usage',label:'AI model usage',value:usageValue,sub:records===null||records===undefined?'Sign in to load tenant usage':summary.total===0?'No verified calls yet':'Verified tenant calls',tone:summary.total>0?'ai':'muted'},
  ];
}
export function workflowProgress(mission){
  const has=!!(mission&&typeof mission==='object');
  const assets=has&&mission.creative&&Array.isArray(mission.creative.assets)?mission.creative.assets.length:0;
  const approval=has?String(mission.approval&&mission.approval.status||'NOT_REQUESTED'):'NONE';
  const live=has&&mission.mode==='LIVE_MARI'&&!!mission.mariReasoning;
  const steps=[
    {id:'business',label:'Business',view:'business'},
    {id:'mari',label:'MARI',view:'mari'},
    {id:'growth',label:'Growth',view:'growth'},
    {id:'creative',label:'Creative',view:'creative'},
    {id:'social',label:'Social',view:'social'},
    {id:'approval',label:'Human Approval',view:'social'},
  ];
  return steps.map(s=>{
    if(!has)return {...s,state:'not-started',detail:s.id==='business'?'Start here':'Waiting for a mission'};
    if(s.id==='business')return {...s,state:'ready',detail:String(mission.business.name)};
    if(s.id==='mari')return {...s,state:live?'in-progress':'ready',detail:live?('Live · '+String(mission.mariReasoning.model)):'Deterministic draft'};
    if(s.id==='growth')return {...s,state:'ready',detail:'Opportunity drafted'};
    if(s.id==='creative'){
      if(assets===0)return {...s,state:'not-started',detail:'No assets yet'};
      return {...s,state:'draft-generated',detail:assets===1?'1 asset pending review':assets+' assets pending review'};
    }
    if(s.id==='social')return {...s,state:'draft-generated',detail:'Facebook + Instagram drafts'};
    if(approval==='APPROVED')return {...s,state:'locally-approved',detail:'Local drafts only · publishing disconnected'};
    if(approval==='REJECTED')return {...s,state:'failed',detail:'Rejected — revise and resend'};
    return {...s,state:'awaiting-approval',detail:'Human review required'};
  });
}
export function activityEvents(mission,records){
  const events=[];
  if(mission&&typeof mission==='object'){
    const at=mission.createdAt||null;
    events.push({type:'mission',label:'Mission created',detail:'Mission '+String(mission.missionId).slice(0,8)+' · '+String(mission.provider).replace(/_/g,' '),at,view:'mari'});
    events.push({type:'evidence',label:'Website evidence',detail:String(mission.evidence&&mission.evidence.websiteStatus||'UNKNOWN').replace(/_/g,' '),at,view:'business'});
    const assets=mission.creative&&Array.isArray(mission.creative.assets)?mission.creative.assets:[];
    for(const a of assets)events.push({type:'creative',label:'Asset generated',detail:String(a.assetId).slice(0,14)+'… · '+String(a.mimeType||''),at:a.createdAt||at,view:'creative'});
    const approval=mission.approval&&typeof mission.approval==='object'?mission.approval:{};
    if(approval.status==='APPROVED'||approval.status==='REJECTED')events.push({type:'approval',label:'Human '+(approval.status==='APPROVED'?'approval':'rejection'),detail:String((approval.actor&&approval.actor.id)||'unknown')+' · local drafts only',at:approval.approvedAt||at,view:'social'});
  }
  for(const r of Array.isArray(records)?records:[]){
    if(!r||typeof r!=='object')continue;
    events.push({type:'model',label:(r.ok===true?'Model call ':'Model call failed ')+'· '+String(r.operation||''),detail:String(r.model||'')+(r.requestId?' · '+String(r.requestId):''),at:r.timestamp||null,view:'activity',model:r.model||null});
  }
  return events;
}
export function guidanceFor(errorCode){
  const code=String(errorCode||'');
  if(!code)return 'No error recorded.';
  if(code==='BUDGET_EXCEEDED'||code==='MARI_QUOTA_EXCEEDED')return 'Workspace budget exhausted. Wait for the daily reset or start a new demo session for isolated quota.';
  if(code==='MARI_UNAUTHORIZED')return 'Start a demo session in the Business workspace, then resend.';
  if(code==='MARI_LIVE_DISABLED')return 'Live inference is disabled on this deployment. The deterministic demo remains available.';
  if(code.startsWith('META_'))return 'The model provider failed this call. Quota was released. Retry shortly.';
  if(code.startsWith('MARI_'))return 'MARI could not complete diagnosis. The deterministic draft is unaffected.';
  if(code.startsWith('CREATIVE_')||code.startsWith('IMAGE_'))return 'Check the prompt, format, and confirmation, then try again. Quota was released.';
  if(code.startsWith('MEDIA_')||code.startsWith('WEBSITE_'))return 'Remote media could not be retrieved safely. Retry or continue without it.';
  return 'Retry the operation. If it persists, verify deployment flags and session expiry.';
}
export function quickActions(mission){
  const has=!!(mission&&typeof mission==='object');
  const assets=has&&mission.creative&&Array.isArray(mission.creative.assets)?mission.creative.assets.length:0;
  const decided=has&&(mission.approval&&['APPROVED','REJECTED'].includes(mission.approval.status));
  return [
    {id:'mission',label:'Create business mission',view:'business',enabled:true,hint:has?'Start a new mission':'Start here'},
    {id:'mari',label:'Ask MARI',view:has?'mari':'business',enabled:true,hint:has?'Review the diagnosis':'Needs a mission first'},
    {id:'growth',label:'Review growth opportunities',view:has?'growth':'business',enabled:has,hint:has?'1 opportunity drafted':'Needs a mission first'},
    {id:'creative',label:'Open Creative Studio',view:has?'creative':'business',enabled:has,hint:has?(assets===0?'No assets yet':'Continue generating'):'Needs a mission first'},
    {id:'social',label:'Review social drafts',view:has?'social':'business',enabled:has,hint:has?'Facebook + Instagram':'Needs a mission first'},
    {id:'approval',label:'Open pending approvals',view:has?'social':'business',enabled:has&&!decided,hint:!has?'Needs a mission first':decided?'Already decided':'Awaiting review'},
  ];
}
