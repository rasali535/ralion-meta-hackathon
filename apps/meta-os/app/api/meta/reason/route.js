import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {reasonWithMeta} from '../../../../lib/meta/provider';
export async function POST(req){
 if(!process.env.MODEL_API_KEY)return NextResponse.json({error:'Meta Model API is not configured on this deployment'},{status:503});
 // No public paid-model endpoint before workspace auth, quotas and rate limits exist.
 if(process.env.META_REASONING_API_ENABLED!=='true'||!process.env.META_REASONING_ACCESS_TOKEN)return NextResponse.json({error:'Meta inference is disabled pending authenticated workspace access'},{status:403});
 const expected=Buffer.from(process.env.META_REASONING_ACCESS_TOKEN);const received=Buffer.from(req.headers.get('x-meta-demo-access')||'');
 if(expected.length!==received.length||!timingSafeEqual(expected,received))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const raw=await req.text();if(raw.length>5000)return NextResponse.json({error:'Payload too large'},{status:413});
  const data=JSON.parse(raw);const result=await reasonWithMeta({business:data.business,mode:data.mode==='wonder'?'wonder':'spark'});
  return NextResponse.json(result,{headers:{'cache-control':'no-store'}});
 }catch(e){const error=String(e.message);return NextResponse.json({error:error.startsWith('META_')?'Meta model request could not be completed':'Invalid request'},{status:error.startsWith('META_')?502:400})}
}
