import {CheckCircle2,AlertCircle,AlertTriangle,Clock,Minus,ChevronRight} from 'lucide-react';
import {liveErrorLabel} from '../../lib/navigation';

export function Badge({tone='muted',children}){
  return <span className={'badge b-'+tone}>{children}</span>;
}
export function ModeBadge({status}){
  if(!status||status.presence==='none')return <Badge tone="muted">No mission</Badge>;
  if(status.live)return <Badge tone="live">Live AI</Badge>;
  return <Badge tone="demo">Deterministic demo</Badge>;
}
export function Card({title,sub,action,children}){
  return <section className="card">
    {(title||action)&&<div className="card-head"><div>{title&&<h3>{title}</h3>}{sub&&<p className="card-sub">{sub}</p>}</div>{action&&<div className="card-action">{action}</div>}</div>}
    <div className="card-body">{children}</div>
  </section>;
}
export function Rows({items}){
  return <dl className="kv">{items.map((r,i)=><div className="kv-row" key={i}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}</dl>;
}
export function EmptyState({icon:Icon,title,body,action}){
  return <div className="empty">{Icon&&<Icon size={30} strokeWidth={1.5}/>}<h3>{title}</h3>{body&&<p>{body}</p>}{action}</div>;
}
const STEP_ICON={done:CheckCircle2,current:Clock,pending:Minus,limited:AlertTriangle,blocked:AlertCircle};
export function Stepper({steps,stateFor,onStep}){
  return <ol className="steps">{steps.map(s=>{
    const st=stateFor(s.id);
    const Icon=STEP_ICON[st]||Minus;
    return <li key={s.id} className={'step '+st}>{onStep?<button type="button" onClick={()=>onStep(s.id)}><Icon size={15}/><span>{s.label}</span></button>:<span><Icon size={15}/><span>{s.label}</span></span>}</li>;
  })}</ol>;
}
export function Banner({tone='info',children}){
  return <div className={'banner bn-'+tone}>{children}</div>;
}
export function Stat({label,value,sub,icon:Icon,tone}){
  return <div className={'stat'+(tone?' tone-'+tone:'')}><span className="stat-top">{Icon&&<span className="stat-ic"><Icon size={14}/></span>}<span className="stat-label">{label}</span></span><span className="stat-value">{value}</span>{sub&&<span className="stat-sub">{sub}</span>}</div>;
}
export function Tracker({steps,onStep}){
  return <ol className="track">{steps.map(s=><li key={s.id}><button type="button" className="track-step" data-state={s.state} onClick={()=>onStep&&onStep(s.view||s.id)} aria-label={s.label+': '+String(s.state).replace(/-/g,' ')}><span className="track-dot" aria-hidden="true"/><span className="track-label">{s.label}</span><span className="track-detail">{s.detail}</span><span className="track-state">{String(s.state).replace(/-/g,' ')}</span><ChevronRight size={15}/></button></li>)}</ol>;
}
export function ProgressBar({value,max}){
  const pct=max>0?Math.round(100*Math.min(max,Math.max(0,value))/max):0;
  return <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label="Workflow progress"><span className="progress-fill" style={{width:pct+'%'}}/></div>;
}
export function Spinner(){
  return <span className="spinner" aria-label="Loading"/>;
}
export function ModelReadiness({status}){
  if(!status)return <p className="muted">Model status unavailable.</p>;
  return <dl className="kv">
    <div className="kv-row"><dt>API</dt><dd>{status.api}</dd></div>
    <div className="kv-row"><dt>Configured</dt><dd>{status.configured?'Yes':'No'}</dd></div>
    <div className="kv-row"><dt>Reasoning</dt><dd className="mono">{(status.reasoning||[]).join(', ')}</dd></div>
    <div className="kv-row"><dt>Image</dt><dd className="mono">{status.image}</dd></div>
    <div className="kv-row"><dt>Segmentation</dt><dd className="mono">{status.segmentation}</dd></div>
    <div className="kv-row"><dt>External actions</dt><dd>{status.externalActions}</dd></div>
  </dl>;
}
export function LiveErrorBanner({code}){
  if(!code)return null;
  return <Banner tone="warn"><strong>Live AI notice. </strong>{liveErrorLabel(code)}</Banner>;
}
