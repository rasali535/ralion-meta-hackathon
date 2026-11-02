import {NextResponse} from 'next/server';
import {modelConfig} from '../../../../lib/meta/provider';
import {describeLiveCapability} from '../../../../lib/inference-access';
import {extractTokenFromRequest} from '../../../../lib/session';
export async function GET(req){
  const c=modelConfig();
  let presented=null;
  try{presented=extractTokenFromRequest(req);}catch{}
  const live=describeLiveCapability({presentedToken:presented});
  return NextResponse.json({api:'Meta Model API',configured:c.configured,reasoning:[c.models.spark,c.models.wonder],image:c.models.image,segmentation:c.models.segment,openWeights:'SEPARATE_HOST_REQUIRED',externalActions:'DISABLED',live},{headers:{'cache-control':'no-store'}});
}
