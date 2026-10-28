import {NextResponse} from 'next/server';
import {listCreativeAssets} from '../../../../lib/creative-store';
import {signAssetUrl} from '../../../../lib/asset-url';
import {creativeConfig} from '../../../../lib/creative';
import {verifyAccessToken,tenantContext} from '../../../../lib/auth';
// Lists the requesting tenant's own assets with fresh signed preview URLs.
// Tenant comes from the verified token only, never from query parameters.
export async function GET(req){
  let tenant;
  try{
    tenant=tenantContext(verifyAccessToken(req.headers.get('x-meta-demo-access'),{staticToken:process.env.META_REASONING_ACCESS_TOKEN,hmacSecret:process.env.META_DEMO_TOKEN_SECRET}));
  }catch(e){
    if(String(e&&e.message)==='AUTH_NOT_CONFIGURED')return NextResponse.json({error:'Access control is not configured on this deployment'},{status:503});
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }
  if(!process.env.ASSET_URL_SECRET)return NextResponse.json({error:'Asset delivery is not configured on this deployment'},{status:503});
  const metas=listCreativeAssets(creativeConfig().storageDir,{organizationId:tenant.organizationId,workspaceId:tenant.workspaceId});
  const assets=metas.map(m=>{
    const signed=signAssetUrl({organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,assetId:m.assetId,hmacSecret:process.env.ASSET_URL_SECRET});
    return {asset:m,url:signed.url,expiresAt:new Date(Number(signed.exp)).toISOString()};
  });
  return NextResponse.json({assets},{headers:{'cache-control':'no-store'}});
}
