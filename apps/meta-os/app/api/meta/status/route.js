import {NextResponse} from 'next/server';
import {modelConfig} from '../../../../lib/meta/provider';
export async function GET(){const c=modelConfig();return NextResponse.json({api:'Meta Model API',configured:c.configured,reasoning:[c.models.spark,c.models.wonder],image:c.models.image,segmentation:c.models.segment,openWeights:'SEPARATE_HOST_REQUIRED',externalActions:'DISABLED'},{headers:{'cache-control':'no-store'}})}
