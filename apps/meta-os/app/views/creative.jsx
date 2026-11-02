import {useState,useEffect,useRef} from 'react';
import {Palette,ArrowRight,RefreshCw,Megaphone,Film,Volume2,Play,Pause} from 'lucide-react';
import {missionStatus} from '../../lib/navigation';
import {buildImagePrompt} from '../../lib/image-prompt';
import {CREATIVE_FORMATS,DEFAULT_CREATIVE_FORMAT} from '../../lib/creative-format';
import {buildMultimediaCampaignPlan} from '../../lib/multimedia';
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

export function ReelCanvasPlayer({businessName,objective,posterUrl,voiceUrl,scenes=[]}){
  const canvasRef=useRef(null);
  const videoRef=useRef(null);
  const audioRef=useRef(null);
  const [playing,setPlaying]=useState(false);
  const [blobVideoUrl,setBlobVideoUrl]=useState(null);
  const [renderingVideo,setRenderingVideo]=useState(false);
  const [sceneIdx,setSceneIdx]=useState(0);
  const imgRef=useRef(null);

  useEffect(()=>{
    if(!posterUrl){imgRef.current=null;return;}
    const im=new Image();
    im.crossOrigin='anonymous';
    im.onload=()=>{imgRef.current=im;drawFrame(0);};
    im.src=posterUrl;
  },[posterUrl]);

  function drawFrame(tSec){
    const c=canvasRef.current;
    if(!c)return;
    const ctx=c.getContext('2d');
    if(!ctx)return;
    const w=c.width,h=c.height;
    const list=Array.isArray(scenes)&&scenes.length>0?scenes:[
      {sceneNumber:1,label:'0:00 – 0:04 · Brand Hook',headline:businessName||'Campaign Reel',subheadline:objective||'Targeted growth campaign',captionOverlay:'Discover our signature experience.'}
    ];
    const idx=Math.min(list.length-1,Math.floor((tSec%12)/4));
    const sc=list[idx]||list[0];

    // Background gradient or Ken Burns image zoom
    const g=ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#0e1722');
    g.addColorStop(0.5,'#162a3a');
    g.addColorStop(1,'#0b1118');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);

    if(imgRef.current){
      const zoom=1.0+0.08*Math.sin((tSec/12)*Math.PI);
      const iw=w*zoom,ih=w*zoom;
      const ix=(w-iw)/2,iy=(h*0.42-ih/2);
      ctx.save();
      ctx.globalAlpha=0.82;
      try{ctx.drawImage(imgRef.current,ix,iy,iw,ih);}catch{}
      ctx.restore();
    }

    // Dark vignette overlay for text legibility
    const vg=ctx.createLinearGradient(0,0,0,h);
    vg.addColorStop(0,'rgba(11,14,19,0.75)');
    vg.addColorStop(0.45,'rgba(11,14,19,0.20)');
    vg.addColorStop(0.75,'rgba(11,14,19,0.85)');
    vg.addColorStop(1,'rgba(11,14,19,0.96)');
    ctx.fillStyle=vg;
    ctx.fillRect(0,0,w,h);

    // Top pill badge
    ctx.fillStyle='rgba(49,181,113,0.9)';
    ctx.fillRect(24,24,220,28);
    ctx.fillStyle='#ffffff';
    ctx.font='bold 12px "Segoe UI", sans-serif';
    ctx.fillText(`MARI REEL · SCENE ${idx+1}/${list.length}`,36,42);

    // Bottom storyboard overlay
    ctx.fillStyle='#46c7b2';
    ctx.font='bold 13px "Segoe UI", sans-serif';
    ctx.fillText(String(sc.label||'Campaign Scene').toUpperCase(),24,h-150);

    ctx.fillStyle='#ffffff';
    ctx.font='bold 22px "Segoe UI", sans-serif';
    ctx.fillText(String(sc.headline||businessName).slice(0,32),24,h-120);

    ctx.fillStyle='#a9b2bf';
    ctx.font='14px "Segoe UI", sans-serif';
    ctx.fillText(String(sc.subheadline||objective).slice(0,46),24,h-92);

    ctx.fillStyle='#e9edf2';
    ctx.font='italic 13px "Segoe UI", sans-serif';
    ctx.fillText(String(sc.captionOverlay||'').slice(0,52),24,h-64);

    // Progress bar
    const pct=Math.min(1,Math.max(0,(tSec%12)/12));
    ctx.fillStyle='rgba(255,255,255,0.18)';
    ctx.fillRect(24,h-32,w-48,6);
    ctx.fillStyle='#31b571';
    ctx.fillRect(24,h-32,(w-48)*pct,6);
  }

  useEffect(()=>{
    drawFrame(0);
  },[businessName,objective,scenes]);

  useEffect(()=>{
    if(!playing)return;
    const t0=performance.now();
    let raf;
    const tick=(now)=>{
      const elapsed=(now-t0)/1000;
      const list=Array.isArray(scenes)&&scenes.length>0?scenes:[{}];
      setSceneIdx(Math.min(list.length-1,Math.floor((elapsed%12)/4)));
      drawFrame(elapsed);
      if(elapsed<12){
        raf=requestAnimationFrame(tick);
      }else{
        setPlaying(false);
        drawFrame(0);
      }
    };
    raf=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf);
  },[playing,scenes,businessName,objective]);

  async function togglePlay(){
    if(playing){
      setPlaying(false);
      if(audioRef.current){try{audioRef.current.pause();}catch{}}
      return;
    }
    setPlaying(true);
    if(audioRef.current){
      try{audioRef.current.currentTime=0;audioRef.current.play().catch(()=>{});}catch{}
    }
    // Also record a playable WebM/MP4 stream into <video> if MediaRecorder is supported
    if(!blobVideoUrl&&!renderingVideo&&canvasRef.current&&typeof canvasRef.current.captureStream==='function'&&typeof MediaRecorder!=='undefined'){
      try{
        setRenderingVideo(true);
        const stream=canvasRef.current.captureStream(24);
        const rec=new MediaRecorder(stream);
        const chunks=[];
        rec.ondataavailable=e=>{if(e.data&&e.data.size>0)chunks.push(e.data);};
        rec.onstop=()=>{
          if(chunks.length>0){
            const blob=new Blob(chunks,{type:rec.mimeType||'video/webm'});
            setBlobVideoUrl(URL.createObjectURL(blob));
          }
          setRenderingVideo(false);
        };
        rec.start();
        setTimeout(()=>{try{if(rec.state==='recording')rec.stop();}catch{}},4000);
      }catch{setRenderingVideo(false);}
    }
  }

  return <div className="reel-studio" style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:16,alignItems:'start'}}>
    <div style={{position:'relative',borderRadius:12,overflow:'hidden',border:'1px solid var(--line)',background:'#0b0e13'}}>
      <canvas ref={canvasRef} width={360} height={520} style={{display:'block',width:'100%',height:'auto'}} aria-label={'Playable campaign video reel for '+businessName}/>
      <div style={{padding:10,display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--raised)',borderTop:'1px solid var(--line-soft)'}}>
        <button type="button" className="btn small primary" onClick={togglePlay}>{playing?<><Pause size={14}/> Pause reel</>:<><Play size={14}/> Play 12s reel</>}</button>
        <Badge tone="ok">{playing?`Scene ${sceneIdx+1}/3`:'9:16 Reel Ready'}</Badge>
      </div>
    </div>
    <div>
      <h4 style={{marginBottom:6}}>Playable Video & Storyboard Timeline</h4>
      <p className="muted" style={{marginBottom:10,fontSize:13}}>Synthesized from {businessName} mission strategy. Click <strong>Play 12s reel</strong> to preview animated Ken Burns scenes with synchronized voiceover audio.</p>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
        {(scenes||[]).map((sc,i)=><div key={sc.id||i} style={{padding:'9px 12px',borderRadius:8,background:'var(--raised)',border:sceneIdx===i&&playing?'1px solid var(--acc)':'1px solid var(--line-soft)'}}>
          <div className="row" style={{justifyContent:'space-between'}}><strong>{sc.label}</strong><Badge tone="muted">{sc.durationSec}s</Badge></div>
          <p style={{fontSize:13,marginTop:3}}><strong>{sc.headline}</strong> — {sc.subheadline}</p>
          <small className="muted">{sc.captionOverlay}</small>
        </div>)}
      </div>
      {voiceUrl&&<div style={{marginBottom:10}}>
        <label className="field" style={{marginBottom:4}}><span>Synchronized Voiceover Track (16-bit PCM WAV)</span></label>
        <audio ref={audioRef} controls src={voiceUrl} style={{width:'100%',height:36}} preload="metadata"/>
      </div>}
      {blobVideoUrl&&<div style={{marginTop:8}}>
        <label className="field" style={{marginBottom:4}}><span>Captured HTML5 Video Stream</span></label>
        <video ref={videoRef} controls loop playsInline src={blobVideoUrl} style={{width:'100%',maxHeight:200,borderRadius:8,border:'1px solid var(--line)'}}/>
      </div>}
    </div>
  </div>;
}

export default function CreativeView({mission,onNavigate,token,session,assets,setAssets,onGenerated,creativeSeed,metaStatus}){
  const status=missionStatus(mission);
  const [briefId,setBriefId]=useState('growth');
  const [briefText,setBriefText]=useState('');
  const [formatId,setFormatId]=useState(DEFAULT_CREATIVE_FORMAT);
  const [prompt,setPrompt]=useState('');
  const [voiceScript,setVoiceScript]=useState('');
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [mediaBusy,setMediaBusy]=useState(false);
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
  const isLiveReady=Boolean(metaStatus&&metaStatus.configured);
  const modelId=isLiveReady?'muse-image-1.0 · Meta Model API':'muse-image-1.0 · Mock offline generator';
  const urlFor=id=>{const hit=(assets||[]).find(e=>e&&e.asset&&e.asset.assetId===id);return hit?hit.url:null;};
  const multimediaPlan=(m.creative&&m.creative.multimedia)||buildMultimediaCampaignPlan(m);
  const effectiveVoiceScript=voiceScript||multimediaPlan.voiceover.script;

  const imageAssets=missionAssets.filter(a=>String(a.mimeType||'').startsWith('image/'));
  const videoAssets=missionAssets.filter(a=>a.mimeType==='video/mp4');
  const voiceAssets=missionAssets.filter(a=>a.mimeType==='audio/wav');
  const firstPosterUrl=imageAssets.length>0?urlFor(imageAssets[0].assetId):null;
  const firstVoiceUrl=voiceAssets.length>0?urlFor(voiceAssets[0].assetId):null;

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

  async function synthesizeMultimedia(kind){
    setError('');setNotice('');
    if(!hasAuth){setError('A valid demo token or session is required. Start a demo session in the Business workspace.');return;}
    setMediaBusy(true);
    try{
      const headers={'content-type':'application/json'};
      if(token)headers['x-meta-demo-access']=token;
      const r=await fetch('/api/creative/generate',{
        method:'POST',
        credentials:'include',
        headers,
        body:JSON.stringify({
          kind,
          brief:{source:selected.id,text:effectiveBrief,businessName:m.business.name,businessIndustry:m.business.industry},
          script:effectiveVoiceScript,
          businessName:m.business.name,
          businessIndustry:m.business.industry,
          objective:m.business.objective,
          audience:m.business.audience,
          posterAssetId:imageAssets[0]?.assetId||null,
          format:'story',
          confirm:true,
          missionId:m.missionId
        })
      });
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(generateErrorMessage(r.status,j));
      onGenerated({asset:j.asset,url:j.url,expiresAt:j.expiresAt},m.missionId);
      setNotice(kind==='voice'?'Voiceover WAV synthesized and bound to mission.':'Playable 9:16 campaign reel synthesized and bound to mission.');
    }catch(err){setError(err.message||'Multimedia synthesis failed.');}
    finally{setMediaBusy(false);}
  }

  function speakVoiceoverBrowser(){
    if(typeof window!=='undefined'&&window.speechSynthesis){
      try{
        window.speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance(effectiveVoiceScript);
        u.rate=1.0;
        window.speechSynthesis.speak(u);
      }catch{}
    }
  }

  return <div className="page">
    <div className="page-head"><div className="row"><h1>Creative Studio</h1><ModeBadge status={status}/><Badge tone="ai">{modelId}</Badge></div><p className="lede">Generate campaign imagery, playable 9:16 video reels, and voiceover narration from {m.business.name} briefs. Every request is explicit, metered, and review-gated.</p></div>
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
    <Card title="Multimedia Campaign Reel & Voice Workflow" sub="Synthesize a playable 9:16 video reel and commercial voiceover track grounded in this mission.">
      <label className="field">Voiceover narration script<textarea className="textarea" value={effectiveVoiceScript} onChange={e=>setVoiceScript(e.target.value)} maxLength={600}/><span className="hint">Voice profile: {multimediaPlan.voiceover.voiceProfile} · Est. duration: {multimediaPlan.voiceover.estimatedDurationSec}s</span></label>
      <div className="row" style={{marginBottom:16}}>
        <button type="button" className="btn small primary" disabled={mediaBusy} onClick={()=>synthesizeMultimedia('video')}><Film size={14}/> {mediaBusy?'Synthesizing…':'Synthesize 9:16 Video Reel'}</button>
        <button type="button" className="btn small primary" disabled={mediaBusy} onClick={()=>synthesizeMultimedia('voice')}><Volume2 size={14}/> {mediaBusy?'Synthesizing…':'Synthesize Voiceover WAV'}</button>
        <button type="button" className="btn small ghost" onClick={speakVoiceoverBrowser}><Play size={14}/> Speak script aloud</button>
      </div>
      <ReelCanvasPlayer businessName={m.business.name} objective={m.business.objective} posterUrl={firstPosterUrl} voiceUrl={firstVoiceUrl} scenes={videoAssets[0]?.storyboard||multimediaPlan.scenes}/>
    </Card>
    <Card title={'Assets ('+missionAssets.length+')'} sub="Stored in isolated workspace storage. Previews expire; bytes do not." action={missionAssets.length>0?<button type="button" className="btn small ghost" onClick={()=>onNavigate('social')}><Megaphone size={14}/> Review in Social</button>:null}>
      {missionAssets.length===0?<p className="muted">No assets yet for this mission. Generate above, or reload the workspace list.</p>:<div className="asset-grid">{missionAssets.map(a=>{
        const url=urlFor(a.assetId);
        const isImg=String(a.mimeType||'').startsWith('image/');
        const isAud=a.mimeType==='audio/wav';
        const isVid=a.mimeType==='video/mp4';
        return <div className="asset-card" key={a.assetId}>
          {isImg?(url?<img src={url} alt={'Generated creative for '+m.business.name} loading="lazy"/>:<p className="muted" style={{padding:12}}>Preview unavailable — reload the workspace list.</p>)
          :isAud?<div style={{padding:16,background:'var(--inset)'}}><strong>Voiceover Track (WAV)</strong>{url&&<audio controls src={url} style={{width:'100%',marginTop:8}}/>}</div>
          :isVid?<div style={{padding:16,background:'var(--inset)'}}><strong>9:16 Campaign Reel (MP4)</strong><p className="muted" style={{fontSize:12,marginTop:4}}>3-scene storyboard container ({a.bytes} bytes)</p></div>
          :null}
          <div className="asset-meta">
            <div className="row">{approved?<Badge tone="ok">Approved with mission</Badge>:<Badge tone="warn">Pending review</Badge>}<Badge tone="muted">{a.mimeType}</Badge>{a.requestedFormat&&a.requestedFormat.label&&<Badge tone="muted">Requested {a.requestedFormat.label}</Badge>}</div>
            <p>{a.prompt}</p>
            <span className="mono">{a.bytes} bytes · {String(a.sha256).slice(0,12)+'…'}</span>
            {isImg&&<div className="row" style={{marginTop:8}}><button type="button" className="btn small ghost" onClick={()=>reloadForRegeneration(a)}><RefreshCw size={13}/> Regenerate</button></div>}
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
