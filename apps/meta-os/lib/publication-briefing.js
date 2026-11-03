/**
 * Publication briefing model for the Activity workspace.
 * Pure and dependency-free (no node imports) so views can use it directly.
 * MARI reads the mission and briefs the rollout: per-channel drafts in
 * posting order, a readiness checklist, and the single blocking requirement.
 * Derived from mission content only. It never publishes and never projects
 * performance: every model carries published:false with metrics:null, and
 * no engagement or outcome words may appear — enforced by tests over the
 * serialized model.
 */
export const BRIEFING_VERSION='1.0';
export const BRIEFING_LIMITS=Object.freeze({caption:140,name:100,channel:40});

function clean(value,max){
  return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
}

export function buildPublicationBriefing(mission,context={}){
  if(!mission||typeof mission!=='object')throw new Error('BRIEFING_MISSION_REQUIRED');
  const mid=String(mission.missionId||'').trim();
  if(!mid)throw new Error('BRIEFING_MISSION_REQUIRED');
  const ctx=context&&typeof context==='object'?context:{};
  const dispatches=Array.isArray(ctx.dispatches)?ctx.dispatches.filter(d=>d&&typeof d==='object'&&String(d.missionId||'')===mid):[];
  const business=mission.business&&typeof mission.business==='object'?mission.business:{};
  const evidence=mission.evidence&&typeof mission.evidence==='object'?mission.evidence:{};
  const social=Array.isArray(mission.social)?mission.social:[];
  const approval=mission.approval&&typeof mission.approval==='object'?mission.approval:{};
  const approved=approval.status==='APPROVED';
  const name=clean(business.name,BRIEFING_LIMITS.name)||'Demo business';
  const channels=social.map((s,i)=>({
    step:i+1,
    channel:clean(s&&s.channel,BRIEFING_LIMITS.channel)||'Channel '+(i+1),
    caption:clean(s&&(s.caption||s.copy),BRIEFING_LIMITS.caption),
    hashtags:Array.isArray(s&&s.hashtags)?s.hashtags.filter(h=>typeof h==='string').map(h=>h.slice(0,60)).slice(0,5):[],
    hasCta:clean(s&&s.cta,1).length>0,
    hasContract:!!(s&&s.socialContract),
    status:clean(s&&s.status,40)||'DRAFT_ONLY',
  }));
  const checklist=[
    {id:'EVIDENCE',label:'Business evidence retrieved',state:evidence.websiteRetrieved===true?'done':'pending'},
    {id:'DRAFTS',label:channels.length+' channel draft(s) written',state:channels.length>0?'done':'pending'},
    {id:'APPROVAL',label:'Human approval recorded',state:approved?'done':'pending'},
    {id:'EXPORT',label:'Sandbox export receipt',state:dispatches.length>0?'done':'pending'},
    {id:'CONNECTOR',label:'Authorized Meta connector',state:'pending'},
  ];
  return {
    schemaVersion:BRIEFING_VERSION,
    missionId:mid,
    status:approved?'READY_FOR_CONNECTOR':(approval.status==='REJECTED'?'NOT_APPROVED':'AWAITING_APPROVAL'),
    business:{name},
    channels,
    checklist,
    blockedBy:approved?['AUTHORIZED_CONNECTOR']:['HUMAN_APPROVAL'],
    dispatchCount:dispatches.length,
    published:false,
    metrics:null,
    summary:approved
      ?channels.length+' channel draft(s) for '+name+' briefed for rollout; posting awaits an authorized Meta connector. Nothing is published and nothing is measured.'
      :channels.length+' channel draft(s) for '+name+' briefed for rollout; human approval is required before anything can post. Nothing is published and nothing is measured.',
  };
}
