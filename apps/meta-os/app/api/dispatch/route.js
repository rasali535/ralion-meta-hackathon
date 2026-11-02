import {NextResponse} from 'next/server';
import {buildDispatchReceipt,dispatchConfig,findReceiptForApproval,saveDispatchReceipt,listDispatchReceipts,verifyDispatchReceipt} from '../../../lib/dispatch';
import {resolveRequestAuth} from '../../../lib/session';
// Sandbox dispatch outbox for approved drafts. POST verifies the submitted
// mission against the full server-minted approval record (plan-hash binding
// rejects post-approval edits), then stores a signed export manifest in
// tenant-isolated storage. Dispatches are idempotent per approval and never
// publish, schedule, spend, or contact any external API. GET lists the
// caller's own tenant receipts, optionally filtered by missionId.
function secret(){
  return process.env.APPROVAL_HMAC_SECRET||process.env.META_DEMO_TOKEN_SECRET||'dev-approval-secret-fallback';
}
export async function POST(request){
  let body;
  try{
    const raw=await request.text();
    if(raw.length>16000)return NextResponse.json({error:'Request too large'},{status:413});
    body=JSON.parse(raw);
  }catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  let tenant;
  try{
    tenant=resolveRequestAuth(request);
  }catch(e){
    return NextResponse.json({error:e.message||'Unauthorized'},{status:e.httpStatus||401});
  }
  const root=dispatchConfig().storageDir;
  try{
    const approvalId=body&&body.approval&&body.approval.approvalId;
    const existing=findReceiptForApproval(root,{organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,approvalId});
    if(existing&&verifyDispatchReceipt(existing,{hmacSecret:secret()})){
      return NextResponse.json({receipt:existing,deduped:true},{headers:{'cache-control':'no-store'}});
    }
    const receipt=buildDispatchReceipt({mission:body.mission,approval:body.approval,tenant,hmacSecret:secret()});
    saveDispatchReceipt(root,{organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,receipt});
    return NextResponse.json({receipt,deduped:false},{headers:{'cache-control':'no-store'}});
  }catch(e){
    const code=String(e&&e.message||'');
    if(code==='DISPATCH_SECRET_REQUIRED')return NextResponse.json({error:'Dispatch is not configured on this deployment'},{status:503});
    return NextResponse.json({error:code.slice(0,120)},{status:400});
  }
}
export async function GET(req){
  let tenant;
  try{
    tenant=resolveRequestAuth(req);
  }catch(e){
    return NextResponse.json({error:e.message||'Unauthorized'},{status:e.httpStatus||401});
  }
  let missionId='';
  let limit=50;
  try{
    const params=new URL(req.url).searchParams;
    missionId=String(params.get('missionId')||'').trim().slice(0,100);
    const raw=Number(params.get('limit'));
    if(Number.isFinite(raw))limit=Math.max(1,Math.min(100,Math.floor(raw)));
  }catch{}
  try{
    const root=dispatchConfig().storageDir;
    let records=listDispatchReceipts(root,{organizationId:tenant.organizationId,workspaceId:tenant.workspaceId});
    if(missionId)records=records.filter(r=>r&&String(r.missionId)===missionId);
    records=records.slice(-limit).reverse();
    return NextResponse.json({records},{headers:{'cache-control':'no-store'}});
  }catch(e){
    return NextResponse.json({error:String(e&&e.message||'Invalid request').slice(0,120)},{status:400});
  }
}
