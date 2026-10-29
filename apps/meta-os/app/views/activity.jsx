import {useEffect,useState} from 'react';
import {Activity,ArrowRight} from 'lucide-react';
import {missionStatus,stepState,WORKFLOW_STEPS} from '../../lib/navigation';
import {buildLearningLoop} from '../../lib/learning-loop';
import {telemetrySummary,guidanceFor} from '../../lib/command';
import {Badge,Card,Rows,EmptyState,ModeBadge,ProgressBar,ModelReadiness,LiveErrorBanner} from '../components/ui';

function fmtTime(iso){
  try{return new Date(iso).toLocaleString();}catch{return 'Recorded with mission';}
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

export default function ActivityView({mission,onNavigate,metaStatus,token,session}){
  const status=missionStatus(mission);
  const [telemetry,setTelemetry]=useState(null);
  const [memoryData,setMemoryData]=useState(null);
  const hasAuth=Boolean(token||session?.authenticated);

  useEffect(()=>{
    if(!hasAuth){setTelemetry(null);setMemoryData(null);return;}
    const headers={};
    if(token)headers['x-meta-demo-access']=token;
    fetch('/api/telemetry/usage?limit=20',{credentials:'include',headers}).then(r=>r.json()).then(j=>{
      setTelemetry(Array.isArray(j&&j.records)?j.records:[]);
    }).catch(()=>setTelemetry([]));
    fetch('/api/memory?limit=20',{credentials:'include',headers}).then(r=>r.json()).then(j=>{
      if(j&&j.ok)setMemoryData(j);
      else setMemoryData(null);
    }).catch(()=>setMemoryData(null));
  },[hasAuth,token]);

  if(status.presence==='none'){
    return <div className="page">
      <div className="page-head"><h1>Activity</h1><p className="lede">Execution history, model usage and audit trail.</p></div>
      <EmptyState icon={Activity} title="Nothing recorded yet" body="Missions, evidence retrievals, model calls and approvals are listed here as they happen." action={<button type="button" className="btn primary" onClick={()=>onNavigate('business')}>Create a mission <ArrowRight size={16}/></button>} />
    </div>;
  }

  const m=mission;
  const done=WORKFLOW_STEPS.filter(s=>stepState(s.id,m)==='done').length;
  const summary=telemetrySummary(telemetry||[]);
  const models=Object.entries(summary.byModel);
  const failures=(telemetry||[]).filter(r=>r&&r.ok!==true);
  const approval=m.approval&&typeof m.approval==='object'?m.approval:{status:'NOT_REQUESTED'};
  const decided=approval.status==='APPROVED'||approval.status==='REJECTED';
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
        {!hasAuth?<p className="muted">Start a demo session to load tenant usage records.</p>
        :telemetry===null?<p className="muted">Loading usage records…</p>
        :telemetry.length===0?<p className="muted">No model calls recorded for this tenant yet.</p>
        :<ul className="timeline">{telemetry.map(r=><li key={r.id}><span className="t-time">{fmtTime(r.timestamp)}</span><span><strong>{r.ok?'Succeeded':'Failed'} · </strong><span className="mono">{r.model}</span>{' · '+r.operation.replace(/-/g,' ')}{r.requestId?' · request '+r.requestId:''}{' · '+fmtLatency(r.latencyMs)}{' · tokens: '+fmtUsage(r.usage)}{r.budget?' · budget '+r.budget.outcome+' ('+(r.budget.remainingUnits??'—')+' left)':''}{r.errorCode?' · '+r.errorCode:''}</span></li>)}</ul>}
      </Card>
      <Card title="Workflow completion" sub={done+' of 6 stages ready.'}>
        <ProgressBar value={done} max={6}/>
        <p className="muted" style={{marginTop:10}}>{decided?'This mission is decided. Measured results still await real authorized campaigns.':'Approval and measured results stay pending until a human reviews and real campaigns run.'}</p>
      </Card>
    </div>
    <div className="grid-2" style={{marginTop:16}}>
      <Card title="Budget status" sub="Latest reported balance per model.">
        {!hasAuth?<p className="muted">Sign in to load tenant budget state.</p>
        :models.length===0?<p className="muted">No usage yet — daily limits are 100 Spark, 25 Wonder, 10 Image calls per workspace.</p>
        :<Rows items={models.map(([model,s])=>({k:model,v:(s.remainingUnits===null||s.remainingUnits===undefined?'Balance unreported':s.remainingUnits+' remaining')+' · '+s.calls+' call(s)'+(s.failures?' · '+s.failures+' failed':'')}))}/>}
      </Card>
      <Card title="Approval history" sub="Decisions recorded on this mission.">
        {!decided?<p className="muted">No approval recorded. Review and decide in the Social workspace.</p>:<Rows items={[
          {k:'Decision',v:String(approval.status).replace(/_/g,' ')},
          {k:'Approver',v:approval.actor?(String(approval.actor.id||'unknown')+' ('+String(approval.actor.role||'—')+')'):'Unknown'},
          {k:'Scope',v:'Local drafts only'},
          {k:'Plan hash',v:<span className="mono">{String(approval.planHash||'—').slice(0,24)+'…'}</span>},
          {k:'Recorded',v:approval.approvedAt?fmtTime(approval.approvedAt):'—'},
        ]}/>}
      </Card>
    </div>
    {failures.length>0&&<Card title="Failed operations" sub="What failed and how to recover. Failed calls release their budget.">
      <Rows items={failures.slice(0,5).map((r,i)=>({k:(r.operation||'operation').replace(/-/g,' ')+' · '+String(r.model||''),v:(r.errorCode||'Unknown error')+' — '+guidanceFor(r.errorCode)}))}/>
    </Card>}
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
    <Card title="Business memory & review lessons" sub="MARI learns from this workspace's review outcomes. Real decisions only — no fabricated performance.">
      {!hasAuth?<p className="muted">Start a demo session to load workspace memory.</p>
      :memoryData===null?<p className="muted">Loading workspace memory…</p>
      :memoryData.totalDecisions===0?<p className="muted">No review decisions recorded in this workspace yet. When you approve or reject drafts in the Social workspace, MARI records the decision and learns your preferences.</p>
      :<>
        <div className="row" style={{marginBottom:10}}>
          <Badge tone="ok">{memoryData.approvedCount} approved</Badge>
          {memoryData.editedCount>0&&<Badge tone="info">{memoryData.editedCount} edited before approval</Badge>}
          {memoryData.rejectedCount>0&&<Badge tone="warn">{memoryData.rejectedCount} declined</Badge>}
          <Badge tone="muted">Workspace isolated</Badge>
        </div>
        <p className="muted" style={{marginBottom:12}}><strong>Draft shaping:</strong> {memoryData.draftingLabel}</p>
        {memoryData.lessons&&memoryData.lessons.length>0?<div className="memory-lessons">
          <ul className="timeline">
            {memoryData.lessons.map(les=>(
              <li key={les.id}>
                <span className="t-time">
                  <Badge tone={les.category==='APPROVED_PATTERN'?'ok':les.category==='STYLE_REVISION'?'info':'warn'}>
                    {les.category.replace(/_/g,' ')}
                  </Badge>
                </span>
                <span>
                  <strong>{les.title}. </strong>
                  {les.summary}
                  {les.delta&&les.delta.after&&<span className="mono" style={{display:'block',fontSize:12,marginTop:2,color:'var(--text-dim)'}}>Refined: "{les.delta.after.slice(0,80)}…"</span>}
                  <span className="muted" style={{display:'block',fontSize:11,marginTop:4}}>
                    Cited source(s): {(les.sourceDecisions||[]).map(s=>'Mission '+String(s.missionId).slice(0,8)+' ('+fmtTime(s.timestamp)+') · '+s.decision).join('; ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>:<p className="muted">No active lessons derived yet.</p>}
        <p className="muted" style={{marginTop:12,fontSize:12,borderTop:'1px solid var(--border)',paddingTop:8}}>
          {memoryData.disclaimer}
        </p>
      </>}
    </Card>
    <Card title="Model readiness" sub="Live status from this deployment.">
      <ModelReadiness status={metaStatus}/>
    </Card>
  </div>;
}
