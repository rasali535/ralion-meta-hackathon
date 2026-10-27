import {Card,Rows,ModelReadiness} from '../components/ui';

export default function SettingsView({theme,setTheme,wsName,setWsName,metaStatus}){
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
