import {NextResponse} from 'next/server';
import {missionInput,planMission} from '../../../lib/mission';
import {ingestWebsite} from '../../../lib/website';
// Public demo route: ingestion is SSRF/size/time-capped with a kill switch.
// Per-actor rate limits land with the auth slice; keep WEBSITE_INGEST_ENABLED=false if abused.
export async function POST(request){
  try{
    const raw=await request.text();
    if(raw.length>8000)return NextResponse.json({error:'Request too large'},{status:413});
    const input=JSON.parse(raw);
    const fields=missionInput(input);
    let evidence=null,ingestError=null;
    if(fields.website&&process.env.WEBSITE_INGEST_ENABLED!=='false'){
      try{evidence=await ingestWebsite(fields.website,{timeoutMs:8000});}
      catch(e){ingestError=e instanceof Error?e.message:'WEBSITE_FETCH_FAILED';}
    }
    const result=planMission(input,{evidence,ingestError});
    return NextResponse.json(result,{headers:{'cache-control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof SyntaxError?'Invalid JSON':String(e.message).slice(0,180)},{status:400})}
}
export async function GET(){return NextResponse.json({error:'Method not allowed'},{status:405})}
