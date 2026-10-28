'use client';
import {useState,useEffect} from 'react';
import {
  LayoutDashboard,
  Building2,
  BrainCircuit,
  TrendingUp,
  Palette,
  Megaphone,
  Activity,
  Settings,
  Menu,
  Sun,
  Moon,
  ChevronLeft,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import {WORKSPACES,parseViewParam} from '../../lib/navigation';
import {missingBusinessFields} from '../../lib/command';
import CommandView from '../views/command';
import BusinessView from '../views/business';
import MariView from '../views/mari';
import GrowthView from '../views/growth';
import CreativeView from '../views/creative';
import SocialView from '../views/social';
import ActivityView from '../views/activity';
import SettingsView from '../views/settings';

const ICONS={
  dashboard:LayoutDashboard,
  building:Building2,
  brain:BrainCircuit,
  growth:TrendingUp,
  palette:Palette,
  megaphone:Megaphone,
  activity:Activity,
  settings:Settings
};

const VIEWS={
  command:CommandView,
  business:BusinessView,
  mari:MariView,
  growth:GrowthView,
  creative:CreativeView,
  social:SocialView,
  activity:ActivityView,
  settings:SettingsView
};

const STARTER_BUSINESS={
  name:'Northstar Coffee',
  industry:'Hospitality / coffee',
  website:'https://example.org',
  audience:'Local morning commuters and remote workers',
  objective:'Increase morning customer visits and establish an afternoon remote-work offering',
  facts:'Speciality roaster with two high-street locations. Strong morning trade; under-used afternoon capacity. Looking to test a focused promotion without heavy discounting.'
};

export default function Shell(){
  const [view,setView]=useState('command');
  const [theme,setThemeState]=useState('dark');
  const [wsName,setWsNameState]=useState('Demo Workspace');
  const [collapsed,setCollapsed]=useState(false);
  const [navOpen,setNavOpen]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const [business,setBusiness]=useState(STARTER_BUSINESS);
  const [live,setLive]=useState(false);
  const [mariMode,setMariMode]=useState('spark');
  const [token,setToken]=useState('');
  const [session,setSession]=useState(null);
  const [sessionBusy,setSessionBusy]=useState(false);
  const [sessionError,setSessionError]=useState('');
  const [mission,setMission]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [pendingGoal,setPendingGoal]=useState('');
  const [creativeSeed,setCreativeSeed]=useState(null);
  const [assets,setAssets]=useState([]);
  const [metaStatus,setMetaStatus]=useState(null);

  async function checkSession(){
    try{
      const r=await fetch('/api/session/demo',{method:'GET',credentials:'include'});
      const j=await r.json().catch(()=>({}));
      if(r.ok&&j&&j.authenticated){
        setSession(j);
        return j;
      }
    }catch{}
    return null;
  }

  async function startDemoSession(workspaceNameOverride){
    setSessionError('');
    if(sessionBusy)return;
    setSessionBusy(true);
    try{
      const r=await fetch('/api/session/demo',{
        method:'POST',
        credentials:'include',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({workspaceName:workspaceNameOverride||wsName})
      });
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Demo session failed');
      setToken(j.token||'');
      setSession({
        authenticated:true,
        organizationId:j.organizationId,
        workspaceId:j.workspaceId,
        expiresAt:j.expiresAt
      });
      return j;
    }catch(err){
      setSessionError(err.message||'Demo session failed');
    }finally{
      setSessionBusy(false);
    }
  }

  async function revokeDemoSession(){
    try{
      await fetch('/api/session/demo',{method:'DELETE',credentials:'include'});
      setSession(null);
      setToken('');
    }catch{}
  }

  useEffect(()=>{
    try{
      const t=localStorage.getItem('ralion-theme');
      if(t==='light'||t==='dark')setThemeState(t);
      const w=localStorage.getItem('ralion-ws');
      if(w)setWsNameState(w.slice(0,60));
    }catch{}
  },[]);

  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
  },[theme]);

  useEffect(()=>{
    fetch('/api/meta/status').then(r=>r.json()).then(setMetaStatus).catch(()=>setMetaStatus(null));
  },[]);

  useEffect(()=>{
    checkSession().then(s=>{
      if(!s){
        startDemoSession();
      }
    });
  },[]);

  useEffect(()=>{
    try{
      const id=parseViewParam(window.location.search);
      if(id)setView(id);
    }catch{}
  },[]);

  function setTheme(v){setThemeState(v);try{localStorage.setItem('ralion-theme',v);}catch{}}
  function setWsName(v){setWsNameState(v);try{localStorage.setItem('ralion-ws',v);}catch{}}
  function update(k,value){setBusiness(p=>({...p,[k]:value}));}
  function navigate(id){setView(id);setNavOpen(false);setMenuOpen(false);try{window.history.replaceState(null,'','?view='+id);}catch{}}

  async function runMission(e,bodyOverride){
    if(e&&e.preventDefault)e.preventDefault();
    setError('');setLoading(true);
    try{
      const headers={'content-type':'application/json'};
      if(token.trim())headers['x-meta-demo-access']=token.trim();
      const r=await fetch('/api/mission',{
        method:'POST',
        credentials:'include',
        headers,
        body:JSON.stringify({...business,...(bodyOverride||{}),live,mariMode})
      });
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||'Mission failed');
      if(bodyOverride)setBusiness(p=>({...p,...bodyOverride}));
      setMission(j);setPendingGoal('');setView('mari');
    }catch(err){setError(err.message||'Mission failed');}
    finally{setLoading(false);}
  }

  function startFromHero(goal){
    const g=String(goal||'').trim().slice(0,300);
    if(!g)return;
    const missing=missingBusinessFields({...business,objective:g});
    setBusiness(p=>({...p,objective:g}));
    if(missing.length>0){setPendingGoal(g);navigate('business');return;}
    runMission(null,{objective:g});
  }

  function followUp(text){
    const t=String(text||'').trim().slice(0,500);
    if(!t||!mission)return;
    const next={...(business||{}),facts:String((business&&business.facts)||'')+(String((business&&business.facts)||'')?'\n':'')+'Follow-up: '+t};
    runMission(null,next);
  }

  function updateDraft(channel,patch){
    setMission(m=>{
      if(!m||!Array.isArray(m.social))return m;
      const social=m.social.map(s=>s.channel===channel?{...s,...patch,socialContract:null}:s);
      const hadDecision=m.approval&&['APPROVED','REJECTED'].includes(m.approval.status);
      return {...m,social,approval:hadDecision?{status:'NOT_REQUESTED',actor:null,editedAfterApproval:true}:m.approval};
    });
  }

  function sendBriefToCreative(){
    setCreativeSeed({briefId:'growth',at:Date.now()});
    navigate('creative');
  }

  function handleGenerated(entry,missionId){
    setAssets(prev=>[...prev.filter(e=>e.asset.assetId!==entry.asset.assetId),entry]);
    setMission(m=>{
      if(!m||m.missionId!==missionId)return m;
      const meta=entry.asset;
      const current=(m.creative&&m.creative.assets)?m.creative.assets:[];
      const next=[...current.filter(a=>a.assetId!==meta.assetId),{assetId:meta.assetId,prompt:meta.prompt,mimeType:meta.mimeType,bytes:meta.bytes,sha256:meta.sha256,reviewStatus:meta.reviewStatus,requestedFormat:meta.requestedFormat||null}];
      return {...m,creative:{...(m.creative||{}),assets:next,generated:true}};
    });
  }

  function handleApproved(record,missionId,approvedMission){
    setMission(m=>{
      if(!m||m.missionId!==missionId)return m;
      const social=approvedMission&&Array.isArray(approvedMission.social)?approvedMission.social:m.social;
      return {...m,social,approval:{status:record.decision==='APPROVED'?'APPROVED':'REJECTED',actor:record.actor||null,scope:record.scope||'LOCAL_DRAFT_ONLY',planHash:record.planHash||'',approvalId:record.approvalId||'',approvedAt:record.approvedAt||'',verified:'server-issued'}};
    });
  }

  const View=VIEWS[view]||CommandView;
  const label=(WORKSPACES.find(w=>w.id===view)||{}).label||'Command Centre';
  const initial=(String(wsName||'D').trim().charAt(0)||'D').toUpperCase();

  return <div className={'os'+(collapsed?' side-collapsed':'')+(navOpen?' nav-open':'')}>
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="side-head"><div className="brand-mark">R</div><div className="brand-text"><strong>RALION OS</strong><small>META AI EDITION</small></div></div>
      <p className="nav-label">WORKSPACES</p>
      <nav className="nav">{WORKSPACES.map(w=>{
        const Icon=ICONS[w.icon]||LayoutDashboard;
        return <button type="button" key={w.id} data-tip={w.label} title={w.label} className={'nav-item'+(view===w.id?' active':'')} onClick={()=>navigate(w.id)} aria-current={view===w.id?'page':undefined}><span className="nav-icon"><Icon size={18}/></span><span className="nav-text">{w.label}</span>{w.availability!=='live'&&<span className="nav-flag">{w.availability==='draft'?'Draft':'Preview'}</span>}</button>;
      })}</nav>
      <div className="side-foot">
        <button type="button" className="collapse-btn" onClick={()=>setCollapsed(c=>!c)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'}><ChevronLeft size={16} style={{transform:collapsed?'rotate(180deg)':'none'}}/><span>{collapsed?'Expand':'Collapse'}</span></button>
      </div>
    </aside>
    <button type="button" className="scrim" aria-label="Close navigation" onClick={()=>setNavOpen(false)}/>
    <div className="main">
      <header className="topbar">
        <button type="button" className="burger" onClick={()=>setNavOpen(true)} aria-label="Open navigation"><Menu size={19}/></button>
        <div className="crumbs"><span className="dim">Workspace</span><span className="dim">/</span><strong>{label}</strong></div>
        <div className="top-actions">
          <span className="env-badge">DEMO ENVIRONMENT</span>
          {session?.authenticated&&<span className="session-badge" title={'Tenant: '+session.organizationId+'/'+session.workspaceId}>DEMO SESSION</span>}
          <button type="button" className="theme-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label="Toggle theme">{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>
          <button type="button" className="ws-chip" onClick={()=>setMenuOpen(o=>!o)} aria-haspopup="menu" aria-expanded={menuOpen}><span className="avatar">{initial}</span><span className="ws-name">{wsName}</span></button>
        </div>
        {menuOpen&&<div className="user-menu" role="menu">
          <div className="um-head"><strong>{wsName}</strong><small>{session?.authenticated?'Active session · '+session.organizationId:'Demo owner · Isolated environment'}</small></div>
          <button type="button" onClick={()=>{setMenuOpen(false);startDemoSession();}}><BrainCircuit size={15}/> New demo workspace</button>
          <button type="button" onClick={()=>{setMenuOpen(false);revokeDemoSession();}}><RotateCcw size={15}/> Reset demo session</button>
          <button type="button" onClick={()=>navigate('settings')}><Settings size={15}/> Workspace settings</button>
          <button type="button" onClick={()=>navigate('activity')}><ShieldCheck size={15}/> Audit trail</button>
        </div>}
      </header>
      <main className="content">
        <View mission={mission} onNavigate={navigate} business={business} update={update} onSubmit={runMission} onHeroSubmit={startFromHero} onFollowup={followUp} loading={loading} error={error} live={live} setLive={setLive} mariMode={mariMode} setMariMode={setMariMode} token={token} setToken={setToken} session={session} sessionBusy={sessionBusy} sessionError={sessionError} onStartSession={startDemoSession} startDemoSession={startDemoSession} revokeDemoSession={revokeDemoSession} pendingGoal={pendingGoal} assets={assets} setAssets={setAssets} onGenerated={handleGenerated} onApproved={handleApproved} onUpdateDraft={updateDraft} creativeSeed={creativeSeed} onSendBrief={sendBriefToCreative} metaStatus={metaStatus} theme={theme} setTheme={setTheme} wsName={wsName} setWsName={setWsName}/>
      </main>
    </div>
  </div>;
}
