import {NextResponse} from 'next/server';
import {listCreativeAssets} from '../../../../lib/creative-store';
import {signAssetUrl} from '../../../../lib/asset-url';
import {creativeConfig} from '../../../../lib/creative';
import {resolveRequestAuth} from '../../../../lib/session';
// Lists the requesting tenant's own assets with fresh signed preview URLs.
// Tenant comes from the verified token/session only, never from query parameters.
export async function GET(req){
  let tenant;
  try{
    tenant=resolveRequestAuth(req);
  }catch(e){
    return NextResponse.json({error:e.message||'Unauthorized'},{status:e.httpStatus||401});
  }
  const assetSecret=process.env.ASSET_URL_SECRET||process.env.META_DEMO_TOKEN_SECRET||'dev-asset-secret-fallback';
  const metas=listCreativeAssets(creativeConfig().storageDir,{organizationId:tenant.organizationId,workspaceId:tenant.workspaceId});
  const assets=metas.map(m=>{
    const signed=signAssetUrl({organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,assetId:m.assetId,hmacSecret:assetSecret});
    return {asset:m,url:signed.url,expiresAt:new Date(Number(signed.exp)).toISOString()};
  });
  return NextResponse.json({assets},{headers:{'cache-control':'no-store'}});
}
