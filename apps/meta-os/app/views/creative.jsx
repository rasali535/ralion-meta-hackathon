import {useEffect,useState} from 'react';
import {ArrowRight,Palette} from 'lucide-react';
import {missionStatus} from '../../lib/navigation';
import {buildImagePrompt} from '../../lib/image-prompt';
import {Badge,Card,Rows,EmptyState,ModeBadge,Banner,LiveErrorBanner,Spinner} from '../components/ui';

function briefOptions(mission){
  const opts=[];
  if(mission.growth&&mission.growth.opportunity)opts.push({id:'growth',label:'Growth opportunity',text:mission.growth.opportunity});
  if(mission.mariReasoning&&mission.mariReasoning.output)opts.push({id:'mari',label:'MARI diagnosis',text:String(mission.mariReasoning.output).slice(0,800)});
  opts.push({id:'custom',label:'Custom brief',text:''});
  return opts;
}
function generateErrorMessage(status,body){
  if(status===403)return 'Image generation is disabled on this deployment.';
  if(status===401)return 'A valid demo token is required. Set it in the Business workspace.';
  if(status===429)return 'Image quota or rate limit exceeded. Try again later.';
  if(status===413)return 'Request too large.';
  if(body&&typeof body.error==='string'&&/^(CREATIVE_|IMAGE_)/.test(body.error))return 'Request rejected: '+body.error.replace(/_/g,' ').toLowerCase()+'.';
  if(status===502)return 'The image model could not complete this request.';
  return 'Image generation failed.';
}

export default function CreativeView({mission,onNavigate,token,assets,setAssets,onGenerated}){
  const status=missionStatus(mission);
  const [briefId,setBriefId]=useState('growth');
  const [briefText,setBriefText]=useState('');
  const [prompt,setPrompt]=useState('');
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [listed,setListed]=useState(false);
  useEffect(()=>{
    if(!token||listed)return;
    fetch('/api/creative/assets',{headers:{'x-meta-demo-access':token}}).then(r=>r.json()).then(j=>{
      if(j&&Array.isArray(j.assets))setAssets(j.assets);
      setListed(true);
    }).catch(()=>setListed(true));
  },[token]);
  if(status.presence==='none'){
    return <div className="page">
      <div className="page-head"><h1>Creative Studio</h1><p className="lede">Campaign concepts and generated assets.</p></div>
      <EmptyState icon={Palette} title="No creative brief yet" body="Creative generation starts from a mission brief — a Growth opportunity, a MARI diagnosis, or your own direction." action={<button type="button" className="btn primary" onClick={()=>onNavigate('business')}>Create a mission <ArrowRight size={16}/></button>} />
    </div>;
  }
  const m=mission;
  const opts=briefOptions(m);
  const selected=opts.find(o=>o.id===briefId)||opts[opts.length-1];
  const effectiveBrief=briefText||selected.text;
  const approved=status.approval==='APPROVED';
  const missionAssets=(m.creative&&m.creative.assets)||[];
  const urlFor=id=>{const hit=(assets||[]).find(e=>e&&e.asset&&e.asset.assetId===id);return hit?hit.url:null;};
  function useSuggestion(){
    try{
      setPrompt(buildImagePrompt({businessName:m.business.name,businessIndustry:m.business.industry,brief:effectiveBrief}));
      setError('');
    }catch(e){setError('Add a brief before building a prompt.');}
  }
  async function generate(e){
    e.preventDefault();
    setError('');setNotice('');
    if(!token){setError('A valid demo token is required. Set it in the Business workspace.');return;}
    if(!confirm){setError('Confirm the request first: every generation may be billable.');return;}
    setBusy(true);
    try{
      const r=await fetch('/api/creative/generate',{method:'POST',headers:{'content-type':'application/json','x-meta-demo-access':token},body:JSON.stringify({brief:{source:selected.id,text:effectiveBrief,businessName:m.business.name,businessIndustry:m.business.industry},prompt,confirm:true,missionId:m.missionId})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(generateErrorMessage(r.status,j));
      onGenerated({asset:j.asset,url:j.url,expiresAt:j.expiresAt},m.missionId);
      setNotice('Asset stored for review. Nothing is published.');
      setPrompt('');setConfirm(false);
    }catch(err){setError(err.message||'Image generation failed.');}
    finally{setBusy(false);}
  }
  return <div className="page">
    <div className="page-head"><div className="row"><h1>Creative Studio</h1><ModeBadge status={status}/></div><p className="lede">Generate campaign imagery from {m.business.name} briefs. Every request is explicit, metered, and review-gated.</p></div>
    <LiveErrorBanner code={status.liveError}/>
    <form className="card" onSubmit={generate}>
      <div className="card-head"><div><h3>New generation</h3><p className="card-sub">Pick a brief, edit the prompt, confirm, then generate.</p></div></div>
      <div className="card-body">
        <div className="approval-grid">
          <label className="field">Brief source<select className="select" value={selected.id} onChange={e=>{setBriefId(e.target.value);setBriefText('');}}>{opts.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label className="field">Brief text<textarea className="textarea" value={effectiveBrief} onChange={e=>setBriefText(e.target.value)} maxLength={1200} placeholder="Creative direction for this asset"/></label>
        </div>
        <label className="field">Image prompt<textarea className="textarea" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={1000} placeholder="Describe the image, or build one from the brief"/><span className="hint">Editable before every request. Empty prompts fall back to the built brief prompt.</span></label>
        <div className="row">
          <button type="button" className="btn small ghost" onClick={useSuggestion}>Use brief suggestion</button>
        </div>
        <div className="check-row"><input id="gen-confirm" type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><label htmlFor="gen-confirm">I authorize this image request. <span className="muted">Image calls draw from the workspace budget.</span></label></div>
        <div className="row"><button type="submit" className="btn primary" disabled={busy}>{busy?<span><Spinner/> Generating…</span>:'Generate image'}</button></div>
        {error&&<p className="error-box" role="alert">{error}</p>}
        {notice&&<Banner tone="ok">{notice}</Banner>}
      </div>
    </form>
    <Card title={'Assets ('+missionAssets.length+')'} sub="Stored in isolated workspace storage. Previews expire; bytes do not.">
      {missionAssets.length===0?<p className="muted">No assets yet for this mission. Generate above, or reload the workspace list.</p>:<div className="asset-grid">{missionAssets.map(a=>{
        const url=urlFor(a.assetId);
        return <div className="asset-card" key={a.assetId}>
          {url?<img src={url} alt={'Generated creative for '+m.business.name} loading="lazy"/>:<p className="muted" style={{padding:12}}>Preview unavailable — reload the workspace list.</p>}
          <div className="asset-meta">
            <div className="row">{approved?<Badge tone="ok">Approved with mission</Badge>:<Badge tone="warn">Pending review</Badge>}<Badge tone="muted">{a.mimeType}</Badge></div>
            <p>{a.prompt}</p>
            <span className="mono">{a.bytes} bytes · {String(a.sha256).slice(0,12)+'…'}</span>
          </div>
        </div>;
      })}</div>}
    </Card>
    <Card title="Generation safeguards" sub="What this studio refuses to do.">
      <Rows items={[
        {k:'Publishing',v:'Never — assets are review-only until a human approves the mission'},
        {k:'Asset storage',v:'Isolated per-workspace bytes; provider URLs are never treated as storage'},
        {k:'Unverified input',v:'Briefs stay labeled by source; nothing is presented as observed fact'},
      ]}/>
    </Card>
  </div>;
}
