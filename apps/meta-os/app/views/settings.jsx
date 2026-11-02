import {Badge,Banner,Card,Rows,ModelReadiness} from '../components/ui';

const LIVE_REASON_LABELS={
  LIVE_READY:'All prerequisites are met.',
  KEY_MISSING:'No server model key is configured on this deployment.',
  LIVE_DISABLED:'Live inference flags are off on this deployment.',
  UNAUTHENTICATED:'This workspace is not authenticated.',
  SESSION_REVOKED:'The current session was revoked.',
  ACCESS_NOT_CONFIGURED:'Access control is not configured on this deployment.',
  BUDGET_EXHAUSTED:'Both reasoning budgets are exhausted for today.',
};

export default function SettingsView({theme,setTheme,wsName,setWsName,metaStatus,session,startDemoSession,revokeDemoSession,live,setLive,mariMode,setMariMode}){
  const liveCap=metaStatus&&metaStatus.live?metaStatus.live:null;
  function budgetText(mode){
    if(!liveCap)return metaStatus?'Unavailable':'Loading…';
    if(!liveCap.authenticated)return 'Start a demo session to load';
    const b=liveCap.budget&&liveCap.budget[mode];
    if(!b||b.remainingUnits===null||b.remainingUnits===undefined)return 'Unreported';
    return b.remainingUnits+' remaining of '+b.dailyLimit+(b.allowed?'':' (exhausted)');
  }
  return <div className="page">
    <div className="page-head"><h1>Settings</h1><p className="lede">Workspace preferences and the usage policy enforced by this deployment.</p></div>
    <div className="grid-2">
      <Card title="Appearance" sub="Stored in this browser only.">
        <label className="field">Theme<select className="select" value={theme} onChange={e=>setTheme(e.target.value)}><option value="dark">Dark</option><option value="light">Light</option></select></label>
      </Card>
      <Card title="Workspace" sub="Display name for this browser session.">
        <label className="field">Workspace name<input className="input" value={wsName} onChange={e=>setWsName(e.target.value.slice(0,60))} maxLength={60} placeholder="Demo workspace"/></label>
        <p className="muted">Server-side tenant isolation uses authenticated organization and workspace IDs, not this label.</p>
      </Card>
    </div>
    <Card title="Demo session" sub="Tenant-scoped credentials issued server-side and stored in a Secure, HttpOnly cookie.">
      <Rows items={[
        {k:'Session status',v:session?.authenticated?'Active':'Not started'},
        {k:'Tenant scope',v:session?.authenticated?session.organizationId+' / '+session.workspaceId:'None'},
        {k:'Cookie security',v:'HttpOnly · SameSite=Lax · Secure (in production)'},
        {k:'Session duration',v:'2 hours (auto-expiring)'},
      ]}/>
      <div className="row" style={{marginTop:12}}>
        <button type="button" className="btn primary small" onClick={()=>startDemoSession&&startDemoSession(wsName)}>Start / Resume demo session</button>
        {session?.authenticated&&<button type="button" className="btn ghost small" onClick={()=>revokeDemoSession&&revokeDemoSession()}>Revoke demo session</button>}
      </div>
    </Card>
    <Card title="Live MARI mode" sub="One-click live reasoning for new missions. Without every prerequisite, missions run as deterministic demos.">
      <div className="row" style={{marginBottom:10}}>
        <Badge tone={liveCap?(liveCap.ready?'ok':'warn'):'muted'}>{liveCap?(liveCap.ready?'LIVE READY':String(liveCap.reason||'UNKNOWN').replace(/_/g,' ')):(metaStatus?'STATUS UNAVAILABLE':'LOADING')}</Badge>
        {live&&<Badge tone="info">LIVE REQUESTED</Badge>}
      </div>
      <Rows items={[
        {k:'Server key',v:liveCap?(liveCap.keyConfigured?'Configured':'Not configured'):(metaStatus?'Unavailable':'Loading…')},
        {k:'Master switch',v:liveCap?(liveCap.masterEnabled?'On':'Off'):(metaStatus?'Unavailable':'Loading…')},
        {k:'MARI switch',v:liveCap?(liveCap.mariEnabled?'On':'Off'):(metaStatus?'Unavailable':'Loading…')},
        {k:'Session',v:liveCap?(liveCap.authenticated?liveCap.organizationId+' / '+liveCap.workspaceId:'Not authenticated'):(metaStatus?'Unavailable':'Loading…')},
        {k:'Spark budget',v:budgetText('spark')},
        {k:'Wonder budget',v:budgetText('wonder')},
      ]}/>
      <div className="check-row" style={{marginTop:12}}><input id="live-toggle" type="checkbox" checked={!!live} onChange={e=>setLive&&setLive(e.target.checked)}/><label htmlFor="live-toggle">Enable live MARI for new missions. <span className="muted">Billable inference with budget guards; any failure falls back to a deterministic demo.</span></label></div>
      {live&&<label className="field" style={{marginTop:8}}>Reasoning model<select className="select" value={mariMode} onChange={e=>setMariMode&&setMariMode(e.target.value)}><option value="spark">Muse Spark (fast)</option><option value="wonder">Muse Wonder (deep)</option></select></label>}
      {live&&liveCap&&!liveCap.ready&&<div style={{marginTop:8}}><Banner tone="warn">Live requested, but {LIVE_REASON_LABELS[liveCap.reason]||liveCap.reason} Missions will run as deterministic demos.</Banner></div>}
      {live&&liveCap&&liveCap.ready&&<div style={{marginTop:8}}><Banner tone="ok">Live MARI ({mariMode==='wonder'?'Muse Wonder':'Muse Spark'}) will run on the next mission.</Banner></div>}
    </Card>
    <Card title="Usage policy" sub="Configured limits in this build. Buckets are per-process memory, not shared quotas.">
      <Rows items={[
        {k:'Rate limit',v:'10 requests per minute per token (burst)'},
        {k:'Daily requests',v:'200 per token per day'},
        {k:'Spark budget',v:'100 calls per workspace per day'},
        {k:'Wonder budget',v:'25 calls per workspace per day'},
        {k:'Image budget',v:'10 calls per workspace per day'},
        {k:'Approval scope',v:'Local drafts only — publishing and spend are disconnected'},
      ]}/>
    </Card>
    <Card title="Model readiness" sub="Live status from this deployment.">
      <ModelReadiness status={metaStatus}/>
    </Card>
    <Card title="Evidence labels" sub="How to read verification states across the app.">
      <Rows items={[
        {k:'User-supplied, unverified',v:'Facts typed into the Business form. Never treated as observed truth.'},
        {k:'Retrieved evidence',v:'Website text fetched server-side with a content hash and source URL.'},
        {k:'Model output',v:'Live AI text grounded only in the supplied claims, with model and request ID.'},
        {k:'Not available',v:'No real data exists. The app shows this instead of inventing metrics.'},
      ]}/>
    </Card>
  </div>;
}
