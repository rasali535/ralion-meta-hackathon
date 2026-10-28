import {NextResponse} from 'next/server';
import {verifyAssetUrl} from '../../../../lib/asset-url';
import {loadCreativeAsset} from '../../../../lib/creative-store';
import {creativeConfig} from '../../../../lib/creative';
// Tenant-bound signed delivery. No demo token is accepted here: the expiring
// capability URL is the credential, scoped to one asset of one tenant.
export async function GET(req){
  const q=req.nextUrl.searchParams;
  let scope;
  const assetSecret=process.env.ASSET_URL_SECRET||process.env.META_DEMO_TOKEN_SECRET||'dev-asset-secret-fallback';
  try{
    scope=verifyAssetUrl({id:q.get('id'),org:q.get('org'),ws:q.get('ws'),exp:q.get('exp'),sig:q.get('sig'),hmacSecret:assetSecret});
  }catch(e){
    if(String(e&&e.message)==='ASSET_SECRET_REQUIRED')return new NextResponse('Asset delivery is not configured',{status:503});
    return new NextResponse('Unauthorized',{status:401});
  }
  try{
    const {metadata,bytes}=loadCreativeAsset(creativeConfig().storageDir,{organizationId:scope.organizationId,workspaceId:scope.workspaceId,assetId:scope.assetId});
    return new NextResponse(bytes,{status:200,headers:{'content-type':metadata.mimeType,'content-length':String(bytes.length),'cache-control':'private, max-age=600','content-disposition':'inline'}});
  }catch{
    return new NextResponse('Not found',{status:404});
  }
}
