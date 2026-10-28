import {NextResponse} from 'next/server';
import {verifyAccessToken,tenantContext} from '../../../../lib/auth';
import {mintMissionApproval} from '../../../../lib/mission';
import {attachSocialHandoffs} from '../../../../lib/social-handoff';
import {creativeConfig} from '../../../../lib/creative';
// Mints a cryptographic approval for the exact submitted mission bytes,
// after verifying declared creative assets against tenant storage.
// Scope is forced to local drafts; approvals never execute anything.
// The returned mission carries canonical per-channel social handoff
// contracts bound to the approval. Attaching handoffs is hash-neutral:
// the plan hash ignores the socialContract key, so verification still
// matches the minted record.
export async function POST(request){
  let body;
  try{
    const raw=await request.text();
    if(raw.length>16000)return NextResponse.json({error:'Request too large'},{status:413});
    body=JSON.parse(raw);
  }catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  let tenant;
  try{
    tenant=tenantContext(verifyAccessToken(request.headers.get('x-meta-demo-access'),{staticToken:process.env.META_REASONING_ACCESS_TOKEN,hmacSecret:process.env.META_DEMO_TOKEN_SECRET}));
  }catch(e){
    if(String(e&&e.message)==='AUTH_NOT_CONFIGURED')return NextResponse.json({error:'Access control is not configured on this deployment'},{status:503});
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }
  try{
    const record=mintMissionApproval(body.mission,{actorId:body.actorId,role:body.role,decision:body.decision,scope:'LOCAL_DRAFT_ONLY',notes:body.notes,organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,hmacSecret:process.env.APPROVAL_HMAC_SECRET,storeRoot:creativeConfig().storageDir});
    const submitted=body.mission&&Array.isArray(body.mission.creative?.assets)?body.mission.creative.assets:[];
    // Tenant ownership of each asset was just proven against storage by
    // mintMissionApproval, so stamping the verified tenant here is sound.
    const verifiedAssets=submitted.map(a=>({...a,organizationId:tenant.organizationId,workspaceId:tenant.workspaceId}));
    const mission=attachSocialHandoffs(body.mission,{tenant,assets:verifiedAssets,approval:record});
    return NextResponse.json({record,mission},{headers:{'cache-control':'no-store'}});
  }catch(e){
    const code=String(e&&e.message||'');
    if(code==='APPROVAL_SECRET_REQUIRED')return NextResponse.json({error:'Approvals are not configured on this deployment'},{status:503});
    return NextResponse.json({error:code.slice(0,120)},{status:400});
  }
}
