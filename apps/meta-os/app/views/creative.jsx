import {ArrowRight,Palette,CheckCircle2,Minus} from 'lucide-react';
import {missionStatus} from '../../lib/navigation';
import {Badge,Card,Rows,EmptyState,ModeBadge,Banner,LiveErrorBanner} from '../components/ui';

export default function CreativeView({mission,onNavigate}){
  const status=missionStatus(mission);
  if(status.presence==='none'){
    return <div className="page">
      <div className="page-head"><h1>Creative</h1><p className="lede">Campaign concepts and asset review.</p></div>
      <EmptyState icon={Palette} title="No creative brief yet" body="Creative direction is written from your mission objective and audience." action={<button type="button" className="btn primary" onClick={()=>onNavigate('business')}>Create a mission <ArrowRight size={16}/></button>} />
    </div>;
  }
  const m=mission;
  return <div className="page">
    <div className="page-head"><div className="row"><h1>Creative</h1><ModeBadge status={status}/><Badge tone="limited">Generation unavailable</Badge></div><p className="lede">Campaign concepts for {m.business.name}. Image generation is not wired in this build.</p></div>
    <LiveErrorBanner code={status.liveError}/>
    <Card title="Creative direction" sub="Written from the mission brief.">
      <Rows items={[
        {k:'Brief',v:m.creative.brief},
        {k:'Generated assets',v:'None — no image generation was performed'},
      ]}/>
    </Card>
    <Card title="Before generation can run" sub="Each item must be real, not assumed.">
      <Banner tone="warn">No images, previews, or assets exist for this mission. Anything visual here would be fabrication, so there is none.</Banner>
      <ul className="check-list">
        <li><Minus size={15}/><span>Verified Meta image adapter with persisted assets — not connected</span></li>
        <li><Minus size={15}/><span>Reviewed brand assets from the business — not supplied</span></li>
        <li><CheckCircle2 size={15}/><span>Human review gate before any use — enforced by approval records</span></li>
      </ul>
    </Card>
  </div>;
}
