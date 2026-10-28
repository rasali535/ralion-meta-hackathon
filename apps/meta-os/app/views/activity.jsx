import {useEffect,useState} from 'react';
import {ArrowRight,Activity} from 'lucide-react';
import {WORKFLOW_STEPS,missionStatus,stepState} from '../../lib/navigation';
import {buildLearningLoop} from '../../lib/learning-loop';
import {Badge,Card,EmptyState,ModeBadge,ProgressBar,ModelReadiness,LiveErrorBanner,Rows} from '../components/ui';

function fmtTime(iso){
  try{return new Date(iso).toLocaleString();}catch{return String(iso||'—');}
}
function fmtLatency(ms){
  return ms===null||ms===undefined?'—':String(ms)+' ms';
}
function fmtUsage(usage){
  if(!usage)return 'Not reported';
  const parts=[];
  if(usage.inputTokens!==null&&usage.inputTokens!==undefined)parts.push('in '+usage.inputTokens);
  if(usage.outputTokens!==null&&usage.outputTokens!==undefined)parts.push('out '+usage.outputTokens);
  return parts.length>0?parts.join(' · '):'Not reported';
}

export default function ActivityView({mission,onNavigate,metaStatus,token}){
  const status=missionStatus(mission);
  const [telemetry,setTelemetry]=useState(null);
  useEffect(()=>{
    if(!token){setTelemetry(null);return;}
    fetch('/api/telemetry/usage?limit=20',{headers:{'x-meta-demo-access':token}}).then(r=>r.json()).then(j=>{
      setTelemetry(Array.isArray(j&&j.records)?j.records:[]);
    }).catch(()=>setTelemetry([]));
  },[token]);
  if(status.presence==='none'){
    return <div className="page">
      <div className="page-head"><h1>Activity</h1><p className="lede">Execution history, model usage and audit trail.</p></div>
      <EmptyState icon={Activity} title="Nothing recorded yet" body="Missions, evidence retrievals, model calls and approvals are listed here as they happen." action={<button type="button" className="btn primary" onClick={()=>onNavigate('business')}>Create a mission <ArrowRight size={16}/></button>} />
    </div>;
  }
  const m=mission;
  const done=WORKFLOW_STEPS.filter(s=>stepState(s.id,m)==='done').length;
  let loop=null;
  try{loop=buildLearningLoop(m);}catch{loop=null;}
  const events=[
    {t:fmtTime(m.createdAt),label:'Mission created',detail:'Mission '+String(m.missionId).slice(0,8)+' · '+String(m.provider).replace(/_/g,' ')},
    {t:fmtTime(m.createdAt),label:'Website evidence',detail:String(m.evidence.websiteStatus).replace(/_/g,' ')+(status.hasEvidence?' · '+String(m.evidence.site.wordCount)+' words, hash verified':'' )},
    {t:fmtTime(m.createdAt),label:'Reasoning',detail:status.live?('Live '+String(m.mariReasoning.model)+' · request '+String(m.mariReasoning.requestId||'—')):'Deterministic demo plan'},
    {t:fmtTime(m.createdAt),label:'Approval',detail:String(m.approval.status).replace(/_/g,' ')},
    {t:fmtTime(m.createdAt),label:'Execution',detail:String(m.execution.status).replace(/_/g,' ')},
  ];
  return <div className="page">
    <div className="page-head"><div className="row"><h1>Activity</h1><ModeBadge status={status}/></div><p className="lede">What was planned, what ran, and what remains unmeasured for {m.business.name}.</p></div>
    <LiveErrorBanner code={status.liveError}/>
    <Card title="Mission trail" sub="Recorded from this mission only.">
      <ul className="timeline">{events.map((e,i)=><li key={i}><span className="t-time">{e.t}</span><span><strong>{e.label}. </strong>{e.detail}</span></li>)}</ul>
    </Card>
    <div className="grid-2">
      <Card title="Model usage" sub="Verified calls on this tenant, newest first.">
        {!token?<p className="muted">Set a demo token to load tenant usage records.</p>
        :telemetry===null?<p className="muted">Loading usage records…</p>
        :telemetry.length===0?<p className="muted">No model calls recorded for this tenant yet.</p>
        :<ul className="timeline">{telemetry.map(r=><li key={r.id}><span className="t-time">{fmtTime(r.timestamp)}</span><span><strong>{r.ok?'Succeeded':'Failed'} · </strong><span className="mono">{r.model}</span>{' · '+r.operation.replace(/-/g,' ')}{r.requestId?' · request '+r.requestId:''}{' · '+fmtLatency(r.latencyMs)}{' · tokens: '+fmtUsage(r.usage)}{r.budget?' · budget '+r.budget.outcome+' ('+(r.budget.remainingUnits??'—')+' left)':''}{r.errorCode?' · '+r.errorCode:''}</span></li>)}</ul>}
      </Card>
      <Card title="Workflow completion" sub={done+' of 6 stages ready.'}>
        <ProgressBar value={done} max={6}/>
        <p className="muted" style={{marginTop:10}}>Approval and measured results stay pending until a human reviews and real campaigns run.</p>
      </Card>
    </div>
    <Card title="Learning loop" sub="Read-only derivation from this mission. Nothing here is measured.">
      {!loop?<p className="muted">This mission cannot be inspected yet.</p>:<>
        <div className="row"><Badge tone="muted">{loop.loopId}</Badge><Badge tone={loop.approval.status==='APPROVED'?'ok':'warn'}>{loop.approval.status.replace(/_/g,' ')}</Badge><Badge tone="muted">Publish NOT CONNECTED</Badge><Badge tone="muted">Performance NOT AVAILABLE</Badge></div>
        <Rows items={[
          {k:'1 · Source evidence',v:loop.sourceEvidence.websiteStatus.replace(/_/g,' ')+(loop.sourceEvidence.retrieved?' · '+loop.sourceEvidence.wordCount+' words · '+String(loop.sourceEvidence.contentHash).slice(0,18)+'…':'')},
          {k:'2 · MARI recommendation',v:(loop.recommendation.opportunity||'—')+(loop.recommendation.live?' (live '+loop.recommendation.model+')':' (deterministic draft)')},
          {k:'3 · Creative generated',v:loop.creative.count===0?'No assets yet':loop.creative.count+' asset(s): '+loop.creative.assets.map(a=>String(a.assetId).slice(0,12)+'…'+(a.format?' ['+a.format+']':'')).join(', ')},
          {k:'4 · Social drafts',v:loop.socialDrafts.length===0?'None':loop.socialDrafts.map(s=>s.channel+' ('+s.status.replace(/_/g,' ')+(s.hasContract?', contract':'')+')').join(' · ')},
          {k:'5 · Human approval',v:loop.approval.status.replace(/_/g,' ')+(loop.approval.actor?' by '+loop.approval.actor+' ('+(loop.approval.role||'—')+')':'')},
          {k:'6 · Publication',v:'NOT CONNECTED — no connector, ad account, or spending path exists'},
          {k:'7 · Performance',v:'NOT AVAILABLE — no impressions, conversions, or revenue are measured'},
        ]}/>
        <p className="muted" style={{marginTop:10}}>{loop.learning}</p>
      </>}
    </Card>
    <Card title="Model readiness" sub="Live status from this deployment.">
      <ModelReadiness status={metaStatus}/>
    </Card>
  </div>;
}
