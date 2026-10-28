import {NextResponse} from 'next/server';
import {modelTelemetry} from '../../../../lib/telemetry';
import {resolveRequestAuth} from '../../../../lib/session';
// Read-only telemetry for the caller's own tenant: verified model-usage
// records from this process. Authenticated but never consumes budget or
// requires inference to be enabled. Cross-tenant reads are impossible:
// records are filtered by the verified token/session tenant.
export async function GET(req){
  let tenant;
  try{
    tenant=resolveRequestAuth(req);
  }catch(e){
    return NextResponse.json({error:e.message||'Unauthorized'},{status:e.httpStatus||401});
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
