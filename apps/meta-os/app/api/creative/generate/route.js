import {NextResponse} from 'next/server';
import {checkInferenceAccess,reserveInferenceUsage,settleInferenceUsage} from '../../../../lib/inference-access';
import {creativeConfig,generateCreativeAsset} from '../../../../lib/creative';
import {signAssetUrl} from '../../../../lib/asset-url';
import {fetchPinnedMedia} from '../../../../lib/website';
import {recordModelUsage} from '../../../../lib/telemetry';
import {MODEL_IDS} from '../../../../lib/meta/provider';
import {extractTokenFromRequest} from '../../../../lib/session';
// Paid image generation: explicit flags, authenticated tenant, shared rate
// limits, atomic image-budget reserve, isolated storage, signed delivery.
// Nothing generates without a direct confirmed request to this endpoint.
function telem(entry){try{recordModelUsage(entry);}catch{}}
function denied(e){
  const headers={'cache-control':'no-store'};
  if(e.httpStatus===429&&e.retryAfterMs)headers['retry-after']=String(Math.max(1,Math.ceil(e.retryAfterMs/1000)));
  return NextResponse.json(e.errorBody||{error:'Request denied'},{status:e.httpStatus,headers});
}
export async function POST(req){
  const cfg=creativeConfig();
  if(!cfg.keyConfigured)return NextResponse.json({error:'Meta Model API is not configured on this deployment'},{status:503});
  if(!cfg.masterEnabled||!cfg.enabled)return NextResponse.json({error:'Creative generation is disabled on this deployment'},{status:403});
  const token=extractTokenFromRequest(req);
  let access;
  try{
    access=checkInferenceAccess({presentedToken:token,mode:'image',allowMock:true});
  }catch(e){
    if(e&&typeof e.httpStatus==='number')return denied(e);
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }
  const assetSecret=process.env.ASSET_URL_SECRET||process.env.META_DEMO_TOKEN_SECRET||'dev-asset-secret-fallback';
  let body;
  try{
    const raw=await req.text();
    if(raw.length>8000)return NextResponse.json({error:'Request too large'},{status:413});
    body=JSON.parse(raw);
  }catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  let receipt;
  try{
    receipt=reserveInferenceUsage({organizationId:access.organizationId,workspaceId:access.workspaceId,mode:'image'});
  }catch(e){
    if(e&&typeof e.httpStatus==='number')return denied(e);
    return NextResponse.json({error:'Workspace inference budget exceeded'},{status:429});
  }
  const t0=Date.now();
  try{
    const generateImpl=process.env.MOCK_IMAGE_GENERATION==='true'
      ?async()=>({model:'muse-image-1.0',imageBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',imageUrl:null,requestId:'mock_img_'+Date.now()})
      :undefined;
    const {metadata}=await generateCreativeAsset({tenant:{organizationId:access.organizationId,workspaceId:access.workspaceId},brief:body.brief,prompt:body.prompt,confirm:body.confirm,missionId:body.missionId,format:body.format,generateImpl,fetchMediaImpl:(url)=>fetchPinnedMedia(url),storeRoot:cfg.storageDir});
    const settled=settleInferenceUsage(receipt,{requestId:metadata.requestId,ok:true});
    telem({model:metadata.model||MODEL_IDS.image,provider:'META_MODEL_API',requestId:metadata.requestId||null,organizationId:access.organizationId,workspaceId:access.workspaceId,operation:'image-generation',ok:true,latencyMs:Date.now()-t0,usage:null,budget:{outcome:'confirmed',remainingUnits:settled.remainingUnits}});
    const signed=signAssetUrl({organizationId:access.organizationId,workspaceId:access.workspaceId,assetId:metadata.assetId,hmacSecret:assetSecret});
    return NextResponse.json({asset:metadata,url:signed.url,expiresAt:new Date(Number(signed.exp)).toISOString(),remainingBudget:settled.remainingUnits},{headers:{'cache-control':'no-store'}});
  }catch(e){
    let released=null;
    try{released=settleInferenceUsage(receipt,{ok:false});}catch{}
    const code=String(e&&e.message||'');
    telem({model:MODEL_IDS.image,provider:'META_MODEL_API',organizationId:access.organizationId,workspaceId:access.workspaceId,operation:'image-generation',ok:false,latencyMs:Date.now()-t0,errorCode:code.slice(0,80)||'CREATIVE_FAILED',budget:released?{outcome:'released',remainingUnits:released.remainingUnits}:null});
    if(e&&typeof e.httpStatus==='number')return denied(e);
    if(/^(CREATIVE_|IMAGE_|ASSET_)/.test(code))return NextResponse.json({error:code.slice(0,80)},{status:400});
    if(code.startsWith('META_')||code.startsWith('MEDIA_'))return NextResponse.json({error:'Image generation could not be completed'},{status:502});
    return NextResponse.json({error:'Creative request failed'},{status:500});
  }
}
