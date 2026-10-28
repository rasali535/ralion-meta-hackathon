import {NextResponse} from 'next/server';
import {reasonWithMeta} from '../../../../lib/meta/provider';
import {checkInferenceAccess,reserveInferenceUsage,settleInferenceUsage} from '../../../../lib/inference-access';
// Paid inference: shared guard (key, master switch, token, rate, budget),
// atomic budget reserve before the model call, settle after.
// Buckets are per-process memory.
export async function POST(req){
  try{
    const raw=await req.text();if(raw.length>5000)return NextResponse.json({error:'Payload too large'},{status:413});
    const data=JSON.parse(raw);
    const mode=data.mode==='wonder'?'wonder':'spark';
    const access=checkInferenceAccess({presentedToken:req.headers.get('x-meta-demo-access'),mode});
    const receipt=reserveInferenceUsage({organizationId:access.organizationId,workspaceId:access.workspaceId,mode});
    let result;
    try{
      result=await reasonWithMeta({business:data.business,mode});
    }catch(e){try{settleInferenceUsage(receipt,{ok:false});}catch{}throw e;}
    const usage=settleInferenceUsage(receipt,{requestId:result.requestId,ok:true});
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
