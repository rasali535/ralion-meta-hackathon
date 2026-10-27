'use client';
import {useEffect,useState} from 'react';
import {Command,Building2,BrainCircuit,TrendingUp,Palette,Megaphone,Activity,Settings,Menu,Sun,Moon,ChevronLeft,ShieldCheck} from 'lucide-react';
import {WORKSPACES,parseViewParam} from '../../lib/navigation';
import {starterBusiness} from '../../lib/modules';
import CommandView from '../views/command';
import BusinessView from '../views/business';
import MariView from '../views/mari';
import GrowthView from '../views/growth';
import CreativeView from '../views/creative';
import SocialView from '../views/social';
import ActivityView from '../views/activity';
import SettingsView from '../views/settings';

const ICONS={Command,Building2,BrainCircuit,TrendingUp,Palette,Megaphone,Activity,Settings};
const VIEWS={command:CommandView,business:BusinessView,mari:MariView,growth:GrowthView,creative:CreativeView,social:SocialView,activity:ActivityView,settings:SettingsView};

export default function Shell({initialView}){
  const [view,setView]=useState(initialView||'command');
  const [collapsed,setCollapsed]=useState(false);
  const [navOpen,setNavOpen]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const [theme,setThemeState]=useState('dark');
  const [wsName,setWsNameState]=useState('Demo workspace');
  const [business,setBusiness]=useState(starterBusiness);
  const [mission,setMission]=useState(null);
  const [metaStatus,setMetaStatus]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [live,setLive]=useState(false);
  const [mariMode,setMariMode]=useState('spark');
  const [token,setToken]=useState('');

  useEffect(()=>{
    try{
      const t=localStorage.getItem('ralion-theme');
      if(t==='light'||t==='dark')setThemeState(t);
      const w=localStorage.getItem('ralion-ws');
      if(w)setWsNameState(w.slice(0,60));
    }catch{}
  },[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
  useEffect(()=>{
    fetch('/api/meta/status').then(r=>r.json()).then(setMetaStatus).catch(()=>setMetaStatus(null));
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

  async function runMission(e){
    e.preventDefault();
    setError('');setLoading(true);
    try{
      const headers={'content-type':'application/json'};
      if(token.trim())headers['x-meta-demo-access']=token.trim();
      const r=await fetch('/api/mission',{method:'POST',headers,body:JSON.stringify({...business,live,mariMode})});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||'Mission failed');
      setMission(j);setView('mari');
    }catch(err){setError(err.message||'Mission failed');}
    finally{setLoading(false);}
  }

  const View=VIEWS[view]||CommandView;
  const label=(WORKSPACES.find(w=>w.id===view)||{}).label||'Command Centre';
  const initial=(String(wsName||'D').trim().charAt(0)||'D').toUpperCase();

  return <div className={'os'+(collapsed?' side-collapsed':'')+(navOpen?' nav-open':'')}>
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="side-head"><div className="brand-mark">R</div><div className="brand-text"><strong>RALION OS</strong><small>META AI EDITION</small></div></div>
      <p className="nav-label">WORKSPACES</p>
      <nav className="nav">{WORKSPACES.map(w=>{
        const Icon=ICONS[w.icon]||Command;
        return <button type="button" key={w.id} className={'nav-item'+(view===w.id?' active':'')} onClick={()=>navigate(w.id)} aria-current={view===w.id?'page':undefined}><span className="nav-icon"><Icon size={18}/></span><span className="nav-text">{w.label}</span>{w.availability!=='live'&&<span className="nav-flag">{w.availability==='draft'?'Draft':'Preview'}</span>}</button>;
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
          <button type="button" className="theme-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label="Toggle theme">{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>
          <button type="button" className="ws-chip" onClick={()=>setMenuOpen(o=>!o)} aria-haspopup="menu" aria-expanded={menuOpen}><span className="avatar">{initial}</span><span className="ws-name">{wsName}</span></button>
        </div>
        {menuOpen&&<div className="user-menu" role="menu">
          <div className="um-head"><strong>{wsName}</strong><small>Demo owner · Isolated environment</small></div>
          <button type="button" onClick={()=>navigate('settings')}><Settings size={15}/> Workspace settings</button>
          <button type="button" onClick={()=>navigate('activity')}><ShieldCheck size={15}/> Audit trail</button>
        </div>}
      </header>
      <main className="content">
        <View mission={mission} onNavigate={navigate} business={business} update={update} onSubmit={runMission} loading={loading} error={error} live={live} setLive={setLive} mariMode={mariMode} setMariMode={setMariMode} token={token} setToken={setToken} metaStatus={metaStatus} theme={theme} setTheme={setTheme} wsName={wsName} setWsName={setWsName}/>
      </main>
    </div>
  </div>;
}
