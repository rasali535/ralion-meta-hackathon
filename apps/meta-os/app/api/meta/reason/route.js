import {NextResponse} from 'next/server';
import {reasonWithMeta} from '../../../../lib/meta/provider';
import {verifyAccessToken,tokenFingerprint} from '../../../../lib/auth';
import {createRateLimiter} from '../../../../lib/ratelimit';
import {globalBudgetLedger} from '../../../../lib/budget';
// Per-instance token buckets: 10/min burst + 200/day per token fingerprint.
// Approximate across serverless instances; tighten in Ralion with shared quotas.
const minuteBucket=createRateLimiter({capacity:10,refillIntervalMs:6000});
const dayBucket=createRateLimiter({capacity:200,refillIntervalMs:432000});
export async function POST(req){
  if(!process.env.MODEL_API_KEY)return NextResponse.json({error:'Meta Model API is not configured on this deployment'},{status:503});
  // No public paid-model endpoint before workspace auth, quotas and rate limits exist.
  if(process.env.META_REASONING_API_ENABLED!=='true')return NextResponse.json({error:'Meta inference is disabled pending authenticated workspace access'},{status:403});
  const presented=req.headers.get('x-meta-demo-access');
  let access;
  try{
    access=verifyAccessToken(presented,{staticToken:process.env.META_REASONING_ACCESS_TOKEN,hmacSecret:process.env.META_DEMO_TOKEN_SECRET});
  }catch(e){
    if(String(e&&e.message)==='AUTH_NOT_CONFIGURED')return NextResponse.json({error:'Access control is not configured on this deployment'},{status:503});
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }
  const fp=tokenFingerprint(presented);
  for(const bucket of [minuteBucket,dayBucket]){
    const r=bucket.check(fp);
    if(!r.allowed)return NextResponse.json({error:'Rate limit exceeded'},{status:429,headers:{'retry-after':String(Math.max(1,Math.ceil(r.retryAfterMs/1000)))}});
  }
  try{
    const raw=await req.text();if(raw.length>5000)return NextResponse.json({error:'Payload too large'},{status:413});
    const data=JSON.parse(raw);
    const mode=data.mode==='wonder'?'wonder':'spark';
    const budget=globalBudgetLedger.checkBudget(access.workspaceId,{model:mode});
    if(!budget.allowed)return NextResponse.json({error:'Workspace inference budget exceeded',remainingUnits:0},{status:429});

    const result=await reasonWithMeta({business:data.business,mode});
    globalBudgetLedger.recordUsage(access.workspaceId,{model:mode,requestId:result.requestId});

    return NextResponse.json({...result,workspaceId:access.workspaceId,remainingBudget:budget.remainingUnits-1},{headers:{'cache-control':'no-store'}});
  }catch(e){const error=String(e.message);return NextResponse.json({error:error.startsWith('META_')?'Meta model request could not be completed':'Invalid request'},{status:error.startsWith('META_')?502:400})}
}
