import {missionStatus} from '../../lib/navigation';
import {Badge,Card,Rows,Banner,ModeBadge,Spinner,LiveErrorBanner} from '../components/ui';

export default function BusinessView(props){
  const {business,update,onSubmit,loading,error,live,setLive,mariMode,setMariMode,token,setToken,mission,session,sessionBusy,sessionError,onStartSession,pendingGoal}=props;
  const status=missionStatus(mission);
  const site=mission&&mission.evidence?mission.evidence.site:null;
  const hasActiveSession=Boolean(session?.authenticated||(session&&token));

  return <div className="page">
    <div className="page-head"><div className="row"><h1>Business</h1><ModeBadge status={status}/></div><p className="lede">Business context is the foundation for every mission. Public website text is retrieved server-side with safety limits.</p></div>
    <Card title="Demo access" sub="One click signs this browser into an isolated demo tenant.">
      {hasActiveSession?<Rows items={[
        {k:'Status',v:<span><Badge tone="ok">Session active</Badge></span>},
        {k:'Tenant',v:<span className="mono">{session.organizationId} / {session.workspaceId}</span>},
        {k:'Expires',v:session.expiresAt||'Auto-expiring'},
        {k:'Security',v:'Secure · HttpOnly · SameSite=Lax cookie'},
      ]}/>:<>
        <p className="muted">Live AI, image generation, telemetry, and approvals need an authenticated tenant. Sessions are rate-limited, expire in 4 hours, and never enable paid inference by themselves.</p>
        <div className="row" style={{marginTop:10}}><button type="button" className="btn primary" disabled={sessionBusy} onClick={()=>onStartSession&&onStartSession()}>{sessionBusy?<span><Spinner/> Starting…</span>:'Start demo session'}</button></div>
        {sessionError&&<p className="error-box" role="alert">{sessionError}</p>}
      </>}
    </Card>
    <form className="card" onSubmit={onSubmit}>
      <div className="card-head"><div><h3>Business profile</h3><p className="card-sub">Use fictional demo details or information you are authorized to share.</p></div></div>
      <div className="card-body">
        {pendingGoal?<Banner tone="ai">Your MARI goal was saved to the objective below. Complete the missing profile fields and send the mission.</Banner>:null}
        <div className="form-grid">
          <label className="field">Business name<input className="input" value={business.name} onChange={e=>update('name',e.target.value)} required maxLength={100} placeholder="Business name"/></label>
          <label className="field">Industry<input className="input" value={business.industry} onChange={e=>update('industry',e.target.value)} required maxLength={100} placeholder="Industry"/></label>
          <label className="field">Business website (public HTTPS)<input className="input" value={business.website} onChange={e=>update('website',e.target.value)} maxLength={500} placeholder="https://example.org" inputMode="url"/></label>
          <label className="field">Target audience<input className="input" value={business.audience} onChange={e=>update('audience',e.target.value)} maxLength={200} placeholder="Target audience"/></label>
        </div>
        <label className="field">Growth objective<textarea className="textarea" value={business.objective} onChange={e=>update('objective',e.target.value)} required maxLength={300}/></label>
        <label className="field">Business facts and differentiators<textarea className="textarea" value={business.facts} onChange={e=>update('facts',e.target.value)} maxLength={2000}/><span className="hint">Recorded as user-supplied and unverified.</span></label>
        <div className="check-row"><input id="live-ai" type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/><label htmlFor="live-ai">Request live MARI diagnosis. <span className="muted">Requires the deployment flags plus a demo session. Without them the mission stays a deterministic demo.</span></label></div>
        {live&&<div className="form-grid">
          <label className="field">Reasoning model<select className="select" value={mariMode} onChange={e=>setMariMode(e.target.value)}><option value="spark">Muse Spark (fast)</option><option value="wonder">Muse Wonder (deep)</option></select></label>
          <label className="field">Demo token override (optional)<input className="input" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Leave blank to use active demo session" autoComplete="off"/><span className="hint">Sent as a request header, never stored.</span></label>
        </div>}
        <div className="row"><button type="submit" className="btn primary" disabled={loading}>{loading?<span><Spinner/> Planning…</span>:'Send mission to MARI'}</button></div>
        {error&&<p className="error-box" role="alert">{error}</p>}
      </div>
    </form>
    {mission&&<Card title="Website evidence" sub={'Retrieval: '+String(mission.evidence.websiteStatus).replace(/_/g,' ')}>
      <LiveErrorBanner code={status.liveError}/>
      {site?<Rows items={[
        {k:'Source',v:<span className="mono">{site.finalUrl}</span>},
        {k:'Title',v:site.title||'—'},
        {k:'Summary',v:String(site.excerpt).slice(0,300)},
        {k:'Size',v:String(site.wordCount)+' words'},
        {k:'Content hash',v:<span className="mono">{String(site.contentHash).slice(0,24)+'…'}</span>},
        {k:'Fetched',v:site.fetchedAt},
      ]}/>:<Banner tone="info">No page text was retrieved for this mission. Blocked or failed retrieval is reported here, never silently skipped.</Banner>}
    </Card>}
  </div>;
}
