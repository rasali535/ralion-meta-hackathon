import {useState,useEffect} from 'react';
import {Palette,ArrowRight,RefreshCw,Megaphone} from 'lucide-react';
import {missionStatus} from '../../lib/navigation';
import {buildImagePrompt} from '../../lib/image-prompt';
import {CREATIVE_FORMATS,DEFAULT_CREATIVE_FORMAT} from '../../lib/creative-format';
import {Badge,Card,Rows,EmptyState,ModeBadge,Banner,LiveErrorBanner,Spinner} from '../components/ui';

function briefOptions(m){
  const opts=[];
  if(m&&m.growth&&m.growth.opportunity){
    opts.push({id:'growth',label:'Growth priority opportunity',text:m.growth.opportunity});
  }
  if(m&&m.mariReasoning&&m.mariReasoning.output){
    opts.push({id:'mari',label:'MARI diagnosis summary',text:String(m.mariReasoning.output).slice(0,400)});
  }
  opts.push({id:'custom',label:'Custom direction',text:''});
  return opts;
}

function generateErrorMessage(status,body){
  if(status===401)return 'A valid demo token or session is required. Start a demo session in the Business workspace.';
  if(status===403)return (body&&body.error)||'Image generation is disabled or the request was unauthorized.';
  if(status===429)return 'Rate limit or workspace budget reached. Retry shortly.';
  return (body&&body.error)||'Image generation failed.';
}

export default function CreativeView({mission,onNavigate,token,session,assets,setAssets,onGenerated,creativeSeed}){
  const status=missionStatus(mission);
  const [briefId,setBriefId]=useState('growth');
  const [briefText,setBriefText]=useState('');
  const [formatId,setFormatId]=useState(DEFAULT_CREATIVE_FORMAT);
  const [prompt,setPrompt]=useState('');
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [listed,setListed]=useState(false);

  const hasAuth=Boolean(token||session?.authenticated);

  useEffect(()=>{
    if(!hasAuth||listed)return;
    const headers={};
    if(token)headers['x-meta-demo-access']=token;
    fetch('/api/creative/assets',{credentials:'include',headers}).then(r=>r.json()).then(j=>{
      if(j&&Array.isArray(j.assets))setAssets(j.assets);
      setListed(true);
    }).catch(()=>setListed(true));
  },[hasAuth,token]);

  useEffect(()=>{
    if(creativeSeed&&creativeSeed.briefId){
      setBriefId(creativeSeed.briefId);
      setBriefText('');
      setNotice('Growth brief received. Review the prompt, confirm, then generate.');
    }
  },[creativeSeed&&creativeSeed.at]);

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
  const modelId='muse-image-1.0 · Mock offline generator';
  const urlFor=id=>{const hit=(assets||[]).find(e=>e&&e.asset&&e.asset.assetId===id);return hit?hit.url:null;};

  function useSuggestion(){
    try{
      setPrompt(buildImagePrompt({businessName:m.business.name,businessIndustry:m.business.industry,brief:effectiveBrief,format:formatId}));
      setError('');
    }catch(e){setError('Add a brief before building a prompt.');}
  }

  function reloadForRegeneration(a){
    setPrompt(String(a.prompt||''));
    if(a.requestedFormat&&a.requestedFormat.id)setFormatId(a.requestedFormat.id);
    setConfirm(false);
    setNotice('Prompt reloaded for regeneration. Confirmation is required — regeneration bills a new request.');
    try{window.scrollTo({top:0,behavior:'smooth'});}catch{}
  }

  async function generate(e){
    e.preventDefault();
    setError('');setNotice('');
    if(!hasAuth){setError('A valid demo token or session is required. Start a demo session in the Business workspace.');return;}
    if(!confirm){setError('Confirm the request first: every generation may be billable.');return;}
    setBusy(true);
    try{
      const headers={'content-type':'application/json'};
      if(token)headers['x-meta-demo-access']=token;
      const r=await fetch('/api/creative/generate',{method:'POST',credentials:'include',headers,body:JSON.stringify({brief:{source:selected.id,text:effectiveBrief,businessName:m.business.name,businessIndustry:m.business.industry},prompt,format:formatId,confirm:true,missionId:m.missionId})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(generateErrorMessage(r.status,j));
      onGenerated({asset:j.asset,url:j.url,expiresAt:j.expiresAt},m.missionId);
      setNotice('Asset stored for review. Nothing is published.');
      setPrompt('');setConfirm(false);
    }catch(err){setError(err.message||'Image generation failed.');}
    finally{setBusy(false);}
  }

  return <div className="page">
    <div className="page-head"><div className="row"><h1>Creative Studio</h1><ModeBadge status={status}/><Badge tone="ai">{modelId}</Badge></div><p className="lede">Generate campaign imagery from {m.business.name} briefs. Every request is explicit, metered, and review-gated.</p></div>
    <LiveErrorBanner code={status.liveError}/>
    <form className="card" onSubmit={generate}>
      <div className="card-head"><div><h3>New generation</h3><p className="card-sub">Pick a brief, choose a format, edit the prompt, confirm, then generate.</p></div></div>
      <div className="card-body">
        <div className="approval-grid">
          <label className="field">Brief source<select className="select" value={selected.id} onChange={e=>{setBriefId(e.target.value);setBriefText('');}}>{opts.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label className="field">Brief text<textarea className="textarea" value={effectiveBrief} onChange={e=>setBriefText(e.target.value)} maxLength={1200} placeholder="Creative direction for this asset"/></label>
        </div>
        <div className="field"><span>Requested format</span>
          <div className="row" role="group" aria-label="Requested image format">
            {CREATIVE_FORMATS.map(f=><button key={f.id} type="button" className={'btn small '+(formatId===f.id?'primary':'ghost')} aria-pressed={formatId===f.id} onClick={()=>setFormatId(f.id)}>{f.label} · {f.width}×{f.height}</button>)}
          </div>
          <span className="hint">Recorded with the asset as the requested size. Native size support is unverified on this deployment — previews show the image as returned.</span>
        </div>
        <label className="field">Image prompt<textarea className="textarea" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={1000} placeholder="Describe the image, or build one from the brief"/><span className="hint">Editable before every request. Your text is sent verbatim; empty prompts fall back to the built brief prompt with framing.</span></label>
        <div className="row">
          <button type="button" className="btn small ghost" onClick={useSuggestion}>Use brief suggestion</button>
        </div>
        <div className="check-row"><input id="gen-confirm" type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><label htmlFor="gen-confirm">I authorize this image request. <span className="muted">Image calls draw from the workspace budget.</span></label></div>
        <div className="row"><button type="submit" className="btn primary" disabled={busy}>{busy?<span><Spinner/> Generating…</span>:'Generate image'}</button></div>
        {error&&<p className="error-box" role="alert">{error}</p>}
        {notice&&<Banner tone="ok">{notice}</Banner>}
      </div>
    </form>
    <Card title={'Assets ('+missionAssets.length+')'} sub="Stored in isolated workspace storage. Previews expire; bytes do not." action={missionAssets.length>0?<button type="button" className="btn small ghost" onClick={()=>onNavigate('social')}><Megaphone size={14}/> Review in Social</button>:null}>
      {missionAssets.length===0?<p className="muted">No assets yet for this mission. Generate above, or reload the workspace list.</p>:<div className="asset-grid">{missionAssets.map(a=>{
        const url=urlFor(a.assetId);
        return <div className="asset-card" key={a.assetId}>
          {url?<img src={url} alt={'Generated creative for '+m.business.name} loading="lazy"/>:<p className="muted" style={{padding:12}}>Preview unavailable — reload the workspace list.</p>}
          <div className="asset-meta">
            <div className="row">{approved?<Badge tone="ok">Approved with mission</Badge>:<Badge tone="warn">Pending review</Badge>}<Badge tone="muted">{a.mimeType}</Badge>{a.requestedFormat&&a.requestedFormat.label&&<Badge tone="muted">Requested {a.requestedFormat.label}</Badge>}</div>
            <p>{a.prompt}</p>
            <span className="mono">{a.bytes} bytes · {String(a.sha256).slice(0,12)+'…'}</span>
            <div className="row" style={{marginTop:8}}><button type="button" className="btn small ghost" onClick={()=>reloadForRegeneration(a)}><RefreshCw size={13}/> Regenerate</button></div>
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
