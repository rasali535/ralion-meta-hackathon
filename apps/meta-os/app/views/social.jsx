import {useState} from 'react';
import {ArrowRight,Megaphone,Pencil} from 'lucide-react';
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

function DraftPost({draft,businessName,previewUrl,onEdit,editing,onSaveEdit,onCancelEdit}){
  const initial=(String(businessName||'?').trim().charAt(0)||'?').toUpperCase();
  const isIg=String(draft.channel).toLowerCase()==='instagram';
  const [caption,setCaption]=useState(draft.caption||draft.copy||'');
  const [cta,setCta]=useState(draft.cta||'');
  if(editing){
    return <div className="post">
      <div className="post-head"><span className={'post-ava'+(isIg?' ig':'')}>{initial}</span><div className="post-who"><strong>{businessName}</strong><small>{draft.channel} · Editing draft</small></div></div>
      <div className="post-body">
        <label className="field">Caption<textarea className="textarea" value={caption} onChange={e=>setCaption(e.target.value)} maxLength={500}/></label>
        <label className="field">Call to action<input className="input" value={cta} onChange={e=>setCta(e.target.value)} maxLength={120}/></label>
        <div className="row">
          <button type="button" className="btn small primary" onClick={()=>onSaveEdit(draft.channel,{caption,cta})}>Save revision</button>
          <button type="button" className="btn small ghost" onClick={onCancelEdit}>Cancel</button>
        </div>
        <p className="muted" style={{marginTop:8}}>Saving invalidates any previous approval — the revision must be reviewed again.</p>
      </div>
    </div>;
  }
  return <div className="post">
    <div className="post-head"><span className={'post-ava'+(isIg?' ig':'')}>{initial}</span><div className="post-who"><strong>{businessName}</strong><small>{draft.channel} · Draft, not posted</small></div></div>
    <p className="post-body">{draft.caption||draft.copy}</p>
    {previewUrl?<div className="post-creative"><img src={previewUrl} alt={draft.channel+' creative preview'} loading="lazy"/></div>:null}
    <div className="post-cta"><span>{draft.cta||'No call to action'}</span><button type="button" className="btn small ghost" onClick={onEdit}><Pencil size={13}/> Edit draft</button></div>
    <div className="post-foot">
      {draft.hashtags&&draft.hashtags.length>0?<p className="muted">{draft.hashtags.join(' ')}</p>:null}
      <div className="chip-row">
        <span className="chip">{(draft.grounding&&draft.grounding.source||'MISSION_DRAFT_DERIVED').replace(/_/g,' ')}</span>
        {draft.grounding&&draft.grounding.memory&&<span className="chip" title="Workspace review memory">{draft.grounding.memory}</span>}
        {(draft.grounding&&draft.grounding.facts||[]).map(f=><span className="chip" key={f}>{f}</span>)}
      </div>
      <small>NOT PUBLISHED · PUBLISHING NOT CONNECTED</small>
    </div>
  </div>;
}

export default function SocialView({mission,onNavigate,token,session,assets,onApproved,onUpdateDraft}){
  const status=missionStatus(mission);
  const [actorId,setActorId]=useState('');
  const [role,setRole]=useState('owner');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [editingChannel,setEditingChannel]=useState(null);
  const approved=status.approval==='APPROVED';
  const rejected=status.approval==='REJECTED';
  const decided=approved||rejected;
  const hasAuth=Boolean(token||session?.authenticated);

  async function decide(decision){
    setError('');
    if(!hasAuth){setError('A valid demo token or session is required. Start a demo session in the Business workspace.');return;}
    if(!actorId.trim()){setError('Enter the approver identity.');return;}
    setBusy(true);
    try{
      const headers={'content-type':'application/json'};
      if(token)headers['x-meta-demo-access']=token;
      const r=await fetch('/api/mission/approve',{method:'POST',credentials:'include',headers,body:JSON.stringify({mission,actorId:actorId.trim(),role,decision})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(r.status===401?'Unauthorized: start a demo session in the Business workspace.':(j.error||'Approval failed.'));
      onApproved(j.record,mission.missionId,j.mission||null);
    }catch(err){setError(err.message||'Approval failed.');}
    finally{setBusy(false);}
  }

  function saveEdit(channel,patch){
    if(onUpdateDraft)onUpdateDraft(channel,{caption:String(patch.caption||'').slice(0,500),cta:String(patch.cta||'').slice(0,120)});
    setEditingChannel(null);
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
  const firstPreview=missionAssets.length>0?urlFor(missionAssets[0].assetId):null;
  const editedAfter=m.approval&&m.approval.editedAfterApproval===true;

  return <div className="page">
    <div className="page-head"><div className="row"><h1>Social</h1><ModeBadge status={status}/><Badge tone="draft">Draft only</Badge></div><p className="lede">Facebook and Instagram plans for {m.business.name} stay in review until a real authorized integration exists.</p></div>
    <LiveErrorBanner code={status.liveError}/>
    <Banner tone="warn">Nothing here is published, scheduled, or approved for publishing. Approval status: {status.approval.replace(/_/g,' ')}.</Banner>
    {editedAfter&&<Banner tone="warn">Drafts were edited after review. The previous approval no longer applies — re-approval is required.</Banner>}
    <div className="draft-grid">{m.social.map(s=><div key={s.channel}><DraftPost draft={s} businessName={m.business.name} previewUrl={firstPreview} onEdit={()=>setEditingChannel(s.channel)} editing={editingChannel===s.channel} onSaveEdit={saveEdit} onCancelEdit={()=>setEditingChannel(null)}/><div style={{marginTop:8}}><HandoffChips draft={s} planHash={planHash}/></div></div>)}</div>
    <Card title="Creative previews" sub="Generated assets attached to this mission, if any.">
      {missionAssets.length===0?<p className="muted">No creative assets yet. Generate them in Creative Studio.</p>:<div className="thumb-row">{missionAssets.map(a=>{const url=urlFor(a.assetId);return url?<img key={a.assetId} src={url} alt="Mission creative preview" loading="lazy"/>:<span key={a.assetId} className="chip">Preview expired</span>;})}</div>}
    </Card>
    <Card title="Human approval" sub="Approvals cover these exact drafts and creatives — any change invalidates them.">
      {decided&&!editedAfter?<Banner tone={approved?'ok':'error'}>{approved?'Approved':'Rejected'} by {m.approval.actor?m.approval.actor.id+' ('+m.approval.actor.role+')':'unknown'} · Scope: local drafts only · {m.approval.approvedAt||''}</Banner>:<>
        {!hasAuth&&<Banner tone="info">Start a demo session in the Business workspace to approve as an authenticated tenant.</Banner>}
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
