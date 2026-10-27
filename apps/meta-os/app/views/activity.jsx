import {ArrowRight,Activity} from 'lucide-react';
import {WORKFLOW_STEPS,missionStatus,stepState} from '../../lib/navigation';
import {Card,EmptyState,ModeBadge,ProgressBar,ModelReadiness,LiveErrorBanner,Rows} from '../components/ui';

function fmtTime(iso){
  try{return new Date(iso).toLocaleString();}catch{return String(iso||'—');}
}

export default function ActivityView({mission,onNavigate,metaStatus}){
  const status=missionStatus(mission);
  if(status.presence==='none'){
    return <div className="page">
      <div className="page-head"><h1>Activity</h1><p className="lede">Execution history, model usage and audit trail.</p></div>
      <EmptyState icon={Activity} title="Nothing recorded yet" body="Missions, evidence retrievals, model calls and approvals are listed here as they happen." action={<button type="button" className="btn primary" onClick={()=>onNavigate('business')}>Create a mission <ArrowRight size={16}/></button>} />
    </div>;
  }
  const m=mission;
  const done=WORKFLOW_STEPS.filter(s=>stepState(s.id,m)==='done').length;
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
      <Card title="Model usage" sub="Live calls on this mission.">
        {status.live?<Rows items={[
          {k:'Model',v:<span className="mono">{String(m.mariReasoning.model)}</span>},
          {k:'Request',v:<span className="mono">{String(m.mariReasoning.requestId||'—')}</span>},
          {k:'Tenant',v:<span className="mono">{String(m.mariReasoning.organizationId||'—')} / {String(m.mariReasoning.workspaceId||'—')}</span>},
          {k:'Budget left',v:String(m.mariReasoning.remainingBudget??'—')},
        ]}/>:<p className="muted">No live model calls on this mission.</p>}
      </Card>
      <Card title="Workflow completion" sub={done+' of 6 stages ready.'}>
        <ProgressBar value={done} max={6}/>
        <p className="muted" style={{marginTop:10}}>Approval and measured results stay pending until a human reviews and real campaigns run.</p>
      </Card>
    </div>
    <Card title="Model readiness" sub="Live status from this deployment.">
      <ModelReadiness status={metaStatus}/>
    </Card>
  </div>;
}
