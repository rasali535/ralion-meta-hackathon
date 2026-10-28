import Shell from './components/shell';
import {parseViewParam} from '../lib/navigation';

export default async function Page({searchParams}){
  const sp=searchParams?await searchParams:{};
  const raw=sp&&typeof sp.view==='string'?sp.view:(sp&&Array.isArray(sp.view)?String(sp.view[0]||''):'');
  return <Shell initialView={parseViewParam('?view='+raw)||'command'}/>;
}
