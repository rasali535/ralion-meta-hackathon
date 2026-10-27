import {NextResponse} from 'next/server';
import {planMission} from '../../../lib/mission';
export async function POST(request){
 try{
  const raw=await request.text();
  if(raw.length>8000)return NextResponse.json({error:'Request too large'},{status:413});
  const result=planMission(JSON.parse(raw));
  return NextResponse.json(result,{headers:{'cache-control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof SyntaxError?'Invalid JSON':String(e.message).slice(0,180)},{status:400})}
}
export async function GET(){return NextResponse.json({error:'Method not allowed'},{status:405})}
