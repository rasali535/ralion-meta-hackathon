/**
 * Read-only learning-loop inspector model for the Activity workspace.
 * Pure and dependency-free (no node imports) so the browser view can use
 * it directly. Derives every section from the mission object only: source
 * evidence, MARI recommendation, generated creative, social drafts, human
 * approval, publication state, and performance state.
 * Publication is always NOT_CONNECTED and performance always
 * NOT_AVAILABLE: this build measures nothing and publishes nothing, and
 * the inspector must never invent impressions, conversions, or revenue.
 */
export const LEARNING_LOOP_VERSION='1.0';

function clean(value,max){
  return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
}
// Deterministic non-cryptographic id (cyrb53): stable across renders for
// the same mission bytes. Not a security boundary; approval hashes live
// server-side in lib/approval.js.
function stableId(text){
  let h1=0xdeadbeef^0,h2=0x41c6ce57^0;
  const s=String(text||'');
  for(let i=0;i<s.length;i++){
    const ch=s.charCodeAt(i);
    h1=Math.imul(h1^ch,2654435761);
    h2=Math.imul(h2^ch,1597334677);
  }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');
}
export function buildLearningLoop(mission){
  if(!mission||typeof mission!=='object')throw new Error('LEARNING_LOOP_MISSION_REQUIRED');
  const mid=String(mission.missionId||'').trim();
  if(!mid)throw new Error('LEARNING_LOOP_MISSION_REQUIRED');
  const business=mission.business&&typeof mission.business==='object'?mission.business:{};
  const evidence=mission.evidence&&typeof mission.evidence==='object'?mission.evidence:{};
  const site=evidence.site&&typeof evidence.site==='object'?evidence.site:null;
  const growth=mission.growth&&typeof mission.growth==='object'?mission.growth:{};
  const assets=mission.creative&&Array.isArray(mission.creative.assets)?mission.creative.assets:[];
  const social=Array.isArray(mission.social)?mission.social:[];
  const approval=mission.approval&&typeof mission.approval==='object'?mission.approval:{};
  return {
    schemaVersion:LEARNING_LOOP_VERSION,
    loopId:'loop_'+stableId(mid+String(approval.planHash||'unapproved')).slice(0,12),
    missionId:mid,
    timestamp:String(mission.createdAt||'').slice(0,40)||null,
    business:{name:clean(business.name,100),industry:clean(business.industry,100)},
    sourceEvidence:{
      websiteStatus:clean(evidence.websiteStatus,60)||'UNKNOWN',
      retrieved:evidence.websiteRetrieved===true,
      wordCount:site&&Number.isFinite(Number(site.wordCount))?Number(site.wordCount):null,
      contentHash:site?clean(site.contentHash,80):null,
    },
    recommendation:{
      opportunity:clean(growth.opportunity,300),
      reason:clean(growth.reason,500),
      measurement:clean(growth.measurement,300),
      live:mission.mode==='LIVE_MARI',
      model:mission.mariReasoning?clean(mission.mariReasoning.model,80):null,
    },
    creative:{
      count:assets.length,
      assets:assets.slice(0,12).map(a=>({assetId:clean(a&&a.assetId,60),prompt:clean(a&&a.prompt,300),mimeType:clean(a&&a.mimeType,40),bytes:Number.isFinite(Number(a&&a.bytes))?Number(a.bytes):null,format:a&&a.requestedFormat&&typeof a.requestedFormat==='object'?clean(a.requestedFormat.label,40):null})),
    },
    socialDrafts:social.map(s=>({channel:clean(s&&s.channel,40),caption:clean(s&&(s.caption||s.copy),200),status:clean(s&&s.status,40)||'DRAFT_ONLY',hasContract:!!(s&&s.socialContract)})),
    approval:{
      status:clean(approval.status,40)||'NOT_REQUESTED',
      actor:approval.actor?clean(approval.actor.id||approval.actor,120):null,
      role:approval.actor?clean(approval.actor.role,40):null,
      planHash:clean(approval.planHash,128)||null,
      approvedAt:clean(approval.approvedAt,40)||null,
    },
    publication:{status:'NOT_CONNECTED',postId:null,publishedAt:null},
    performance:{status:'NOT_AVAILABLE'},
    learning:approval.status==='APPROVED'
      ?'Approved drafts are ready for a future authorized integration. No performance data exists until real campaigns run.'
      :'The loop cannot learn until a human approves these drafts and real campaigns run.',
  };
}
