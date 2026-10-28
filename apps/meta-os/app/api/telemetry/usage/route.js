import {NextResponse} from 'next/server';
import {verifyAccessToken,tenantContext} from '../../../../lib/auth';
import {modelTelemetry} from '../../../../lib/telemetry';
// Read-only telemetry for the caller's own tenant: verified model-usage
// records from this process. Authenticated but never consumes budget or
// requires inference to be enabled. Cross-tenant reads are impossible:
// records are filtered by the verified token tenant.
export async function GET(req){
  let tenant;
  try{
    tenant=tenantContext(verifyAccessToken(req.headers.get('x-meta-demo-access'),{staticToken:process.env.META_REASONING_ACCESS_TOKEN,hmacSecret:process.env.META_DEMO_TOKEN_SECRET}));
  }catch(e){
    if(String(e&&e.message)==='AUTH_NOT_CONFIGURED')return NextResponse.json({error:'Access control is not configured on this deployment'},{status:503});
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }
  let limit=50;
  try{limit=new URL(req.url).searchParams.get('limit');}catch{}
  try{
    const records=modelTelemetry.list({organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,limit});
    return NextResponse.json({records},{headers:{'cache-control':'no-store'}});
  }catch(e){
    return NextResponse.json({error:String(e&&e.message||'Invalid request').slice(0,120)},{status:400});
  }
}
