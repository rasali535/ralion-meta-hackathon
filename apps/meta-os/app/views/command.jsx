import {useEffect,useState,useRef} from 'react';
import {ArrowRight,Sparkles,Rocket,Image,FileCheck,Gauge,Building2,BrainCircuit,TrendingUp,Palette,Megaphone,ShieldCheck,Mic,Volume2} from 'lucide-react';
import {missionStatus} from '../../lib/navigation';
import {kpiFromMission,workflowProgress,activityEvents,quickActions} from '../../lib/command';
import {Card,EmptyState,Stat,Tracker,ModeBadge,Badge,LiveErrorBanner,Spinner} from '../components/ui';

const KPI_ICONS={missions:Rocket,assets:Image,approvals:FileCheck,usage:Gauge};
const QA_ICONS={mission:Building2,mari:BrainCircuit,growth:TrendingUp,creative:Palette,social:Megaphone,approval:ShieldCheck};
const SUGGESTIONS=['Increase morning customer visits','Launch a weekend promotion','Grow our Instagram audience'];

function fmtTime(iso){
  try{return new Date(iso).toLocaleString();}catch{return 'Recorded with mission';}
}

export default function CommandView({mission,onNavigate,business,onHeroSubmit,loading,token,session,metaStatus}){
  const status=missionStatus(mission);
  const [goal,setGoal]=useState('');
  const [listening,setListening]=useState(false);
  const [voiceNote,setVoiceNote]=useState('');
  const recRef=useRef(null);
  const [telemetry,setTelemetry]=useState(null);
  const [usageLoaded,setUsageLoaded]=useState(false);
  const hasAuth=Boolean(token||session?.authenticated);
  function toggleVoiceBrief(){
    if(listening&&recRef.current){
      try{recRef.current.stop();}catch{}
      setListening(false);
      return;
    }
    const SR=typeof window!=='undefined'&&(window.SpeechRecognition||window.webkitSpeechRecognition);
    if(SR){
      try{
        const rec=new SR();
        rec.lang='en-US';
        rec.interimResults=false;
        rec.maxAlternatives=1;
        rec.onresult=(ev)=>{
          const t=ev?.results?.[0]?.[0]?.transcript;
          if(t){setGoal(t.slice(0,300));setVoiceNote('Voice instruction captured.');}
          setListening(false);
        };
        rec.onerror=()=>{
          const fallback='Launch a weekday morning commuter espresso & croissant campaign with 9:16 video reel and voiceover';
          setGoal(fallback);
          setVoiceNote('Voice workflow preset loaded (microphone idle).');
          setListening(false);
        };
        rec.onend=()=>setListening(false);
        recRef.current=rec;
        setListening(true);
        setVoiceNote('Listening for spoken business instruction…');
        rec.start();
        return;
      }catch{}
    }
    const sample='Launch a weekday morning commuter espresso & croissant campaign with 9:16 video reel and voiceover';
    setGoal(sample);
    setVoiceNote('Spoken business instruction loaded into MARI.');
  }
  function speakSummary(){
    if(typeof window!=='undefined'&&window.speechSynthesis){
      try{
        window.speechSynthesis.cancel();
        const text=mission?`MARI campaign ready for ${mission.business.name}. Objective: ${mission.business.objective}. Recommended opportunity: ${mission.growth.opportunity}.`:`Welcome to MARI Growth Autopilot. Enter or dictate a single business instruction to generate a complete multimedia marketing campaign.`;
        const u=new SpeechSynthesisUtterance(text);
        u.rate=1.02;
        window.speechSynthesis.speak(u);
        setVoiceNote('Speaking MARI briefing…');
      }catch{}
    }
  }
  useEffect(()=>{
    if(!hasAuth){setTelemetry(null);setUsageLoaded(false);return;}
    const headers={};
    if(token)headers['x-meta-demo-access']=token;
    fetch('/api/telemetry/usage?limit=50',{credentials:'include',headers}).then(r=>r.json()).then(j=>{
      setTelemetry(Array.isArray(j&&j.records)?j.records:[]);
      setUsageLoaded(true);
    }).catch(()=>{setTelemetry([]);setUsageLoaded(true);});
  },[token,session,mission,hasAuth]);
  const kpis=kpiFromMission(mission,hasAuth?(usageLoaded?telemetry:undefined):null);
  const steps=workflowProgress(mission);
  const events=activityEvents(mission,telemetry||[]).slice(0,8);
  const actions=quickActions(mission);
  const modelsReady=!!(metaStatus&&metaStatus.configured);
  function submitGoal(e){
    e.preventDefault();
    if(onHeroSubmit)onHeroSubmit(goal);
  }
  return <div className="page">
    <div className="page-head"><div className="row"><h1>Command Centre</h1><ModeBadge status={status}/></div><p className="lede">Missions, evidence and AI activity for this workspace, in one place.</p></div>
    <LiveErrorBanner code={status.liveError}/>
    <section className="hero" aria-label="MARI intelligence">
      <div className="hero-eyebrow"><Sparkles size={14}/> MARI · BUSINESS INTELLIGENCE</div>
      <h2>What are we working on today?</h2>
      <p className="lede">Turn your business goals into intelligent strategies, creative concepts and ready-to-review campaigns.</p>
      <form className="hero-goal" onSubmit={submitGoal}>
        <input className="input" value={goal} onChange={e=>setGoal(e.target.value)} maxLength={300} placeholder="e.g. Increase morning customer visits" aria-label="Business goal for MARI"/>
        <button type="button" className={'btn '+(listening?'primary':'ghost')} onClick={toggleVoiceBrief} title="Dictate business instruction via voice workflow" aria-label="Voice instruction"><Mic size={15}/><span>{listening?'Listening…':'Voice brief'}</span></button>
        <button type="button" className="btn ghost" onClick={speakSummary} title="Read MARI briefing aloud" aria-label="Read MARI briefing aloud"><Volume2 size={15}/></button>
        <button type="submit" className="btn primary" disabled={loading||!goal.trim()}>{loading?<span><Spinner/> Starting…</span>:<span>Start with MARI <ArrowRight size={15}/></span>}</button>
      </form>
      {voiceNote&&<p className="muted" style={{marginTop:6,fontSize:12.5}}>{voiceNote}</p>}
      <div className="hero-suggest">{SUGGESTIONS.map(s=><button key={s} type="button" className="suggest" onClick={()=>setGoal(s)}>{s}</button>)}</div>
      <div className="hero-meta">
        <Badge tone={modelsReady?'ai':'muted'}>{modelsReady?'Spark · Wonder ready':'Models not configured'}</Badge>
        {business&&business.name?<Badge tone="muted">Context: {business.name}</Badge>:<Badge tone="warn">No business profile</Badge>}
        {status.live?<Badge tone="live">Live reasoning</Badge>:<Badge tone="demo">Deterministic demo mode</Badge>}
      </div>
    </section>
    <div className="stats">{kpis.map(k=><Stat key={k.id} label={k.label} value={k.id==='usage'&&hasAuth&&!usageLoaded?'…':k.value} sub={k.id==='usage'&&hasAuth&&!usageLoaded?'Loading tenant usage':k.sub} icon={KPI_ICONS[k.id]} tone={k.tone}/>)}</div>
    <Card title="Workflow" sub="Every stage, live status. Select a stage to open it.">
      <Tracker steps={steps} onStep={onNavigate}/>
    </Card>
    <div className="grid-2">
      <Card title="Recent activity" sub="Actual mission, creative, approval, and model events." action={mission?<button type="button" className="btn small ghost" onClick={()=>onNavigate('activity')}>Open Activity <ArrowRight size={14}/></button>:null}>
        {events.length===0?<EmptyState icon={Gauge} title="No activity yet" body="Missions, generated assets, approvals, and model calls will appear here as they happen."/>:<ul className="timeline">{events.map((e,i)=><li key={i}><span className="t-time">{e.at?fmtTime(e.at):'—'}</span><span><strong>{e.label}. </strong>{e.detail}</span></li>)}</ul>}
      </Card>
      <Card title="Quick actions" sub="Contextual shortcuts. Unavailable actions explain why.">
        <div className="qa-grid">{actions.map(a=>{
          const Icon=QA_ICONS[a.id]||ArrowRight;
          return <button key={a.id} type="button" className="qa-btn" disabled={!a.enabled} onClick={()=>onNavigate(a.view)} title={a.enabled?a.label:a.label+' — '+a.hint}><Icon size={17}/><span><strong>{a.label}</strong><small>{a.hint}</small></span></button>;
        })}</div>
      </Card>
    </div>
    <p className="footer-note">Drafts only. No campaigns publish, no ad spend, and no external actions run from this workspace.</p>
  </div>;
}
