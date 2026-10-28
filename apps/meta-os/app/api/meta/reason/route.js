import {NextResponse} from 'next/server';
import {reasonWithMeta} from '../../../../lib/meta/provider';
import {checkInferenceAccess,recordInferenceUsage} from '../../../../lib/inference-access';
// Paid inference: shared guard (key, master switch, token, rate, budget).
// Payload is validated before quota is consumed; usage is recorded only
// after a successful model response. Buckets are per-process memory.
export async function POST(req){
  try{
    const raw=await req.text();if(raw.length>5000)return NextResponse.json({error:'Payload too large'},{status:413});
    const data=JSON.parse(raw);
    const mode=data.mode==='wonder'?'wonder':'spark';
    const access=checkInferenceAccess({presentedToken:req.headers.get('x-meta-demo-access'),mode});
    const result=await reasonWithMeta({business:data.business,mode});
    const usage=recordInferenceUsage({organizationId:access.organizationId,workspaceId:access.workspaceId,mode,requestId:result.requestId});
    return NextResponse.json({...result,organizationId:access.organizationId,workspaceId:access.workspaceId,remainingBudget:usage.remainingUnits},{headers:{'cache-control':'no-store'}});
  }catch(e){
    if(e&&typeof e.httpStatus==='number'){
      const headers={'cache-control':'no-store'};
      if(e.httpStatus===429&&e.retryAfterMs)headers['retry-after']=String(Math.max(1,Math.ceil(e.retryAfterMs/1000)));
      return NextResponse.json(e.errorBody||{error:'Request denied'},{status:e.httpStatus,headers});
    }
    const error=String(e.message);return NextResponse.json({error:error.startsWith('META_')?'Meta model request could not be completed':'Invalid request'},{status:error.startsWith('META_')?502:400});
  }
}
