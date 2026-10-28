import {NextResponse} from 'next/server';
import {
  createDemoSession,
  resolveRequestAuth,
  extractTokenFromRequest,
  revokeSession,
  createSessionCookieString,
  createRevokeCookieString
} from '../../../../lib/session.js';

function isSecureRequest(req){
  if(process.env.NODE_ENV==='production')return true;
  const proto=req.headers?.get?req.headers.get('x-forwarded-proto'):null;
  return proto==='https';
}

export async function GET(req){
  try{
    const auth=resolveRequestAuth(req);
    return NextResponse.json({
      authenticated:true,
      organizationId:auth.organizationId,
      workspaceId:auth.workspaceId,
      via:auth.via,
      fingerprint:auth.fingerprint
    },{headers:{'cache-control':'no-store'}});
  }catch(e){
    return NextResponse.json({
      authenticated:false,
      reason:e&&e.code?e.code:'AUTH_REQUIRED'
    },{headers:{'cache-control':'no-store'}});
  }
}

export async function POST(req){
  let body={};
  try{
    const raw=await req.text();
    if(raw)body=JSON.parse(raw);
  }catch{}
  const secure=isSecureRequest(req);
  try{
    const session=createDemoSession({workspaceName:body.workspaceName});
    const cookieHeader=createSessionCookieString(session.token,{secure});
    return NextResponse.json({
      ok:true,
      authenticated:true,
      organizationId:session.organizationId,
      workspaceId:session.workspaceId,
      expiresAt:session.expiresAt
    },{
      status:201,
      headers:{
        'set-cookie':cookieHeader,
        'cache-control':'no-store'
      }
    });
  }catch(e){
    return NextResponse.json({
      error:e.message||'Failed to issue demo session'
    },{status:500});
  }
}

export async function DELETE(req){
  const token=extractTokenFromRequest(req);
  if(token){
    try{revokeSession(token);}catch{}
  }
  const secure=isSecureRequest(req);
  const cookieHeader=createRevokeCookieString({secure});
  return NextResponse.json({
    ok:true,
    authenticated:false,
    revoked:true
  },{
    headers:{
      'set-cookie':cookieHeader,
      'cache-control':'no-store'
    }
  });
}
