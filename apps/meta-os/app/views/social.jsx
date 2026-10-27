import {ArrowRight,Megaphone} from 'lucide-react';
import {missionStatus} from '../../lib/navigation';
import {Badge,Card,EmptyState,ModeBadge,Banner,LiveErrorBanner} from '../components/ui';

export default function SocialView({mission,onNavigate}){
  const status=missionStatus(mission);
  if(status.presence==='none'){
    return <div className="page">
      <div className="page-head"><h1>Social</h1><p className="lede">Facebook and Instagram drafts and approvals.</p></div>
      <EmptyState icon={Megaphone} title="No social drafts yet" body="Social campaign drafts are written from your mission once it exists." action={<button type="button" className="btn primary" onClick={()=>onNavigate('business')}>Create a mission <ArrowRight size={16}/></button>} />
    </div>;
  }
  const m=mission;
  return <div className="page">
    <div className="page-head"><div className="row"><h1>Social</h1><ModeBadge status={status}/><Badge tone="draft">Draft only</Badge></div><p className="lede">Facebook and Instagram plans for {m.business.name} stay in review until a real authorized integration exists.</p></div>
    <LiveErrorBanner code={status.liveError}/>
    <Banner tone="warn">Nothing here is published, scheduled, or approved for publishing. Approval status: {status.approval.replace(/_/g,' ')}.</Banner>
    <div className="draft-grid">{m.social.map(s=><div className="draft-card" key={s.channel}><Badge tone="muted">{s.channel}</Badge><h4>Campaign draft</h4><p>{s.copy}</p><small>NOT PUBLISHED · NOT APPROVED</small></div>)}</div>
    <Card title="Publishing safeguards">
      <p className="muted">Approvals in this build cover local drafts only. No social connector, ad account, or spending path is connected, so approval cannot trigger publishing.</p>
    </Card>
  </div>;
}
