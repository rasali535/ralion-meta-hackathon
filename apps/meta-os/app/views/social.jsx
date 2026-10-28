import {useState} from 'react';
import {ArrowRight,Megaphone} from 'lucide-react';
import {missionStatus} from '../../lib/navigation';
import {verifySocialHandoffBinding} from '../../lib/social-handoff';
import {Badge,Card,EmptyState,ModeBadge,Banner,LiveErrorBanner,Spinner} from '../components/ui';

function HandoffChips({draft,planHash}){
  const h=draft.socialContract;
  if(!h)return <small className="muted">No handoff contract yet — contracts are minted at approval.</small>;
  const bound=verifySocialHandoffBinding(h,planHash);
  return <div className="chip-row">
    <span className="chip">Contract {h.channel} · {h.status.replace(/_/g,' ')}</span>
    {h.assetId?<span className="chip">Asset {String(h.assetId).slice(0,12)+'…'}</span>:<span className="chip">No creative attached</span>}
    {h.campaign?<span className="chip">{h.campaign}</span>:null}
    <span className="chip">{bound?'Approval bound':'Approval unbound'}</span>
    <span className="chip">Publish {h.publishStatus.replace(/_/g,' ')}</span>
  </div>;
}

export default function SocialView({mission,onNavigate,token,session,assets,onApproved}){
  const status=missionStatus(mission);
  const [actorId,setActorId]=useState('');
  const [role,setRole]=useState('owner');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const approved=status.approval==='APPROVED';
  const rejected=status.approval==='REJECTED';
  const decided=approved||rejected;
  async function decide(decision){
    setError('');
    if(!token && !session?.authenticated){setError('A valid demo session is required. Start a session from Settings or the topbar.');return;}
    if(!actorId.trim()){setError('Enter the approver identity.');return;}
    setBusy(true);
    try{
      const headers={'content-type':'application/json'};
      if(token)headers['x-meta-demo-access']=token;
      const r=await fetch('/api/mission/approve',{method:'POST',credentials:'include',headers,body:JSON.stringify({mission,actorId:actorId.trim(),role,decision})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(r.status===401?'Unauthorized: check the demo session or token.':(j.error||'Approval failed.'));
      onApproved(j.record,mission.missionId,j.mission||null);
    }catch(err){setError(err.message||'Approval failed.');}
    finally{setBusy(false);}
  }
  if(status.presence==='none'){
    return <div className="page">
      <div className="page-head"><h1>Social</h1><p className="lede">Facebook and Instagram drafts and approvals.</p></div>
      <EmptyState icon={Megaphone} title="No social drafts yet" body="Social campaign drafts are written from your mission once it exists." action={<button type="button" className="btn primary" onClick={()=>onNavigate('business')}>Create a mission <ArrowRight size={16}/></button>} />
    </div>;
  }
  const m=mission;
  const missionAssets=(m.creative&&m.creative.assets)||[];
  const urlFor=id=>{const hit=(assets||[]).find(e=>e&&e.asset&&e.asset.assetId===id);return hit?hit.url:null;};
  const planHash=m.approval&&m.approval.planHash?m.approval.planHash:'';
  return <div className="page">
    <div className="page-head"><div className="row"><h1>Social</h1><ModeBadge status={status}/><Badge tone="draft">Draft only</Badge></div><p className="lede">Facebook and Instagram plans for {m.business.name} stay in review until a real authorized integration exists.</p></div>
    <LiveErrorBanner code={status.liveError}/>
    <Banner tone="warn">Nothing here is published, scheduled, or approved for publishing. Approval status: {status.approval.replace(/_/g,' ')}.</Banner>
    <div className="draft-grid">{m.social.map(s=><div className="draft-card" key={s.channel}><Badge tone="muted">{s.channel}</Badge><h4>Campaign draft</h4><p>{s.caption||s.copy}</p><p className="muted">Call to action: {s.cta||'—'}{s.hashtags&&s.hashtags.length>0?' · '+s.hashtags.join(' '):''}</p><div className="chip-row"><span className="chip">{(s.grounding&&s.grounding.source||'MISSION_DRAFT_DERIVED').replace(/_/g,' ')}</span>{(s.grounding&&s.grounding.facts||[]).map(f=><span className="chip" key={f}>{f}</span>)}</div><HandoffChips draft={s} planHash={planHash}/><small>NOT PUBLISHED · PUBLISHING NOT APPROVED</small></div>)}</div>
    <Card title="Creative previews" sub="Generated assets attached to this mission, if any.">
      {missionAssets.length===0?<p className="muted">No creative assets yet. Generate them in Creative Studio.</p>:<div className="thumb-row">{missionAssets.map(a=>{const url=urlFor(a.assetId);return url?<img key={a.assetId} src={url} alt="Mission creative preview" loading="lazy"/>:<span key={a.assetId} className="chip">Preview expired</span>;})}</div>}
    </Card>
    <Card title="Human approval" sub="Approvals cover these exact drafts and creatives — any change invalidates them.">
      {decided?<Banner tone={approved?'ok':'error'}>{approved?'Approved':'Rejected'} by {m.approval.actor?m.approval.actor.id+' ('+m.approval.actor.role+')':'unknown'} · Scope: local drafts only · {m.approval.approvedAt||''}</Banner>:<>
        {!token&&!session?.authenticated&&<Banner tone="info">Start a demo session from Settings or the topbar to approve as an authenticated tenant.</Banner>}
        <div className="approval-grid">
          <label className="field">Approver identity<input className="input" value={actorId} onChange={e=>setActorId(e.target.value)} maxLength={120} placeholder="Demo approver name"/></label>
          <label className="field">Role<select className="select" value={role} onChange={e=>setRole(e.target.value)}><option value="owner">Owner</option><option value="growth_admin">Growth admin</option><option value="marketing_lead">Marketing lead</option></select></label>
        </div>
        <div className="row">
          <button type="button" className="btn primary" disabled={busy} onClick={()=>decide('APPROVED')}>{busy?<span><Spinner/> Recording…</span>:'Approve drafts'}</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={()=>decide('REJECTED')}>Reject</button>
        </div>
        {error&&<p className="error-box" role="alert">{error}</p>}
      </>}
    </Card>
    <Card title="Publishing safeguards">
      <p className="muted">Approvals in this build cover local drafts only. No social connector, ad account, or spending path is connected, so approval cannot trigger publishing.</p>
    </Card>
  </div>;
}
