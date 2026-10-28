import {NextResponse} from 'next/server';
import {reasonWithMeta,MODEL_IDS} from '../../../../lib/meta/provider';
import {checkInferenceAccess,reserveInferenceUsage,settleInferenceUsage} from '../../../../lib/inference-access';
import {recordModelUsage} from '../../../../lib/telemetry';
import {extractTokenFromRequest} from '../../../../lib/session';
// Paid inference: shared guard (key, master switch, token, rate, budget),
// atomic budget reserve before the model call, settle after.
// Buckets are per-process memory. Telemetry records verified call facts
// and never breaks the route.
function telem(entry){try{recordModelUsage(entry);}catch{}}
export async function POST(req){
  try{
    const raw=await req.text();if(raw.length>5000)return NextResponse.json({error:'Payload too large'},{status:413});
    const data=JSON.parse(raw);
    const mode=data.mode==='wonder'?'wonder':'spark';
    const token=extractTokenFromRequest(req);
    const access=checkInferenceAccess({presentedToken:token,mode});
    const receipt=reserveInferenceUsage({organizationId:access.organizationId,workspaceId:access.workspaceId,mode});
    const t0=Date.now();
    let result;
    try{
      result=await reasonWithMeta({business:data.business,mode});
    }catch(e){
      let released=null;
      try{released=settleInferenceUsage(receipt,{ok:false});}catch{}
      telem({model:MODEL_IDS[mode],provider:'META_MODEL_API',organizationId:access.organizationId,workspaceId:access.workspaceId,operation:'reason',ok:false,latencyMs:Date.now()-t0,errorCode:String(e&&e.message||'META_REASON_FAILED').slice(0,80),budget:released?{outcome:'released',remainingUnits:released.remainingUnits}:null});
      throw e;
    }
    const usage=settleInferenceUsage(receipt,{requestId:result.requestId,ok:true});
    telem({model:result.model||MODEL_IDS[mode],provider:'META_MODEL_API',requestId:result.requestId||null,organizationId:access.organizationId,workspaceId:access.workspaceId,operation:'reason',ok:true,latencyMs:Date.now()-t0,usage:result.usage||null,budget:{outcome:'confirmed',remainingUnits:usage.remainingUnits}});
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
