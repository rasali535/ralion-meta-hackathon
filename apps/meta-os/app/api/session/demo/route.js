import {NextResponse} from 'next/server';
import {
  requestDemoSession,
  resolveRequestAuth,
  extractTokenFromRequest,
  revokeSession,
  createSessionCookieString,
  createRevokeCookieString,
  getFallbackDemoSecret
} from '../../../../lib/session';

function clientKey(req){
  const fwd=req.headers.get('x-forwarded-for');
  if(fwd)return String(fwd).split(',')[0].trim().slice(0,120)||'direct';
  return 'direct';
}

function isProd(){
  return process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL);
}

/**
 * GET /api/session/demo
 * Returns active session metadata if valid cookie or header exists.
 */
export async function GET(req){
  try{
    const auth=resolveRequestAuth(req);
    return NextResponse.json({
      ok:true,
      authenticated:true,
      organizationId:auth.organizationId,
      workspaceId:auth.workspaceId
    },{headers:{'cache-control':'no-store'}});
  }catch(e){
    return NextResponse.json({
      ok:false,
      authenticated:false,
      error:e&&e.message?e.message:'No active session'
    },{status:200,headers:{'cache-control':'no-store'}});
  }
}

/**
 * POST /api/session/demo
 * Issues short-lived, rate-limited demo session with HttpOnly cookie.
 */
export async function POST(req){
  const secret=process.env.META_DEMO_TOKEN_SECRET||getFallbackDemoSecret();
  try{
    const session=requestDemoSession({
      clientKey:clientKey(req),
      hmacSecret:secret
    });
    const cookieHeader=createSessionCookieString(session.token,{
      secure:isProd()
    });
    const headers={
      'cache-control':'no-store',
      'set-cookie':cookieHeader
    };
    return NextResponse.json({
      ok:true,
      authenticated:true,
      organizationId:session.organizationId,
      workspaceId:session.workspaceId,
      expiresAt:session.expiresAt,
      token:session.token
    },{headers});
  }catch(e){
    if(e&&e.message==='DEMO_SESSION_RATE_LIMITED'){
      const headers={'cache-control':'no-store'};
      if(e.retryAfterMs)headers['retry-after']=String(Math.max(1,Math.ceil(e.retryAfterMs/1000)));
      return NextResponse.json({error:'Too many demo sessions requested. Try again later.'},{status:429,headers});
    }
    if(e&&e.message==='AUTH_NOT_CONFIGURED'){
      return NextResponse.json({error:'Demo sessions are not configured on this deployment'},{status:503});
    }
    return NextResponse.json({error:'Demo session failed'},{status:500});
  }
}

/**
 * DELETE /api/session/demo
 * Revokes current session and clears HttpOnly cookie.
 */
export async function DELETE(req){
  const token=extractTokenFromRequest(req);
  if(token){
    revokeSession(token);
  }
  const revokeHeader=createRevokeCookieString({secure:isProd()});
  return NextResponse.json({
    ok:true,
    revoked:true
  },{
    headers:{
      'cache-control':'no-store',
      'set-cookie':revokeHeader
    }
  });
}
