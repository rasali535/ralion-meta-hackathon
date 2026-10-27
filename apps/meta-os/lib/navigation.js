/**
 * Pure navigation + status model for the OS shell.
 * No React, no browser APIs: safe for server import and unit tests.
 * Icon fields are lucide-react component names resolved by the shell.
 */
export const WORKSPACES=[
  {id:'command',label:'Command Centre',icon:'Command',blurb:'Business overview, mission activity and AI insights.',availability:'live'},
  {id:'business',label:'Business',icon:'Building2',blurb:'Business profile, website evidence and knowledge.',availability:'live'},
  {id:'mari',label:'MARI',icon:'BrainCircuit',blurb:'AI reasoning, missions and recommended actions.',availability:'live'},
  {id:'growth',label:'Growth',icon:'TrendingUp',blurb:'Opportunities, strategies and campaign proposals.',availability:'draft'},
  {id:'creative',label:'Creative',icon:'Palette',blurb:'Campaign concepts and asset review.',availability:'preview'},
  {id:'social',label:'Social',icon:'Megaphone',blurb:'Facebook and Instagram drafts and approvals.',availability:'draft'},
  {id:'activity',label:'Activity',icon:'Activity',blurb:'Execution history, model usage and audit trail.',availability:'live'},
  {id:'settings',label:'Settings',icon:'Settings',blurb:'Workspace preferences and usage limits.',availability:'live'},
];
export const WORKSPACE_IDS=Object.freeze(WORKSPACES.map(w=>w.id));
export const WORKFLOW_STEPS=[
  {id:'business',label:'Business Context'},
  {id:'mari',label:'MARI Analysis'},
  {id:'growth',label:'Growth Strategy'},
  {id:'creative',label:'Creative Generation'},
  {id:'social',label:'Social Draft'},
  {id:'approval',label:'Human Approval'},
];
export const LIVE_ERROR_LABELS=Object.freeze({
  MARI_LIVE_DISABLED:'Live AI is disabled on this deployment.',
  MARI_UNAUTHORIZED:'Live AI needs a valid demo token.',
  MARI_QUOTA_EXCEEDED:'Live AI quota exceeded. Try again later.',
  MARI_MODE_INVALID:'Unknown reasoning mode selected.',
  MARI_ACCESS_DENIED:'Live AI access was denied.',
  MARI_DIAGNOSIS_FAILED:'Live AI request failed. Showing deterministic demo.',
  BUDGET_EXCEEDED:'Workspace inference budget exhausted.',
});
export function liveErrorLabel(code){
  if(typeof code!=='string'||!code)return null;
  return LIVE_ERROR_LABELS[code]||('Live AI notice: '+code.slice(0,60));
}
export function missionStatus(mission){
  if(!mission||typeof mission!=='object')return {presence:'none',mode:'none',live:false,liveError:null,approval:'NONE',hasEvidence:false,hasAi:false};
  const live=mission.mode==='LIVE_MARI'&&!!mission.mariReasoning;
  return {
    presence:'active',
    mode:live?'live':'demo',
    live,
    liveError:typeof mission.liveError==='string'?mission.liveError:null,
    approval:String(mission.approval&&mission.approval.status||'NOT_REQUESTED'),
    hasEvidence:!!(mission.evidence&&mission.evidence.websiteRetrieved),
    hasAi:!!mission.mariReasoning,
  };
}
export function parseViewParam(search){
  const m=/[?&]view=([a-z]+)/i.exec(String(search||''));
  const id=m?m[1].toLowerCase():'';
  return WORKSPACE_IDS.includes(id)?id:null;
}
export function stepState(stepId,mission){
  const st=missionStatus(mission);
  if(st.presence==='none')return stepId==='business'?'current':'pending';
  if(stepId==='approval'){
    if(st.approval==='APPROVED')return 'done';
    if(st.approval==='REJECTED')return 'blocked';
    return 'current';
  }
  if(stepId==='creative')return 'limited';
  if(stepId==='business'||stepId==='mari'||stepId==='growth'||stepId==='social')return 'done';
  return 'pending';
}
