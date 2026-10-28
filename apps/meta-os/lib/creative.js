/**
 * Server-side creative generation flow for Creative Studio.
 * Orchestrates prompt resolution, billable image inference, media
 * retrieval or decoding, type/size enforcement, and isolated storage.
 * The route supplies verified tenant context, budgets, and secrets;
 * inject generateImpl/fetchMediaImpl for tests. Never store or serve
 * expiring provider URLs as permanent assets.
 */
import {generateWithMuseImage} from './meta/provider.js';
import {resolveCreativePrompt,IMAGE_PROMPT_MAX_CHARS} from './image-prompt.js';
import {resolveCreativeFormat} from './creative-format.js';
import {mintAssetId,saveCreativeAsset,sha256Hex} from './creative-store.js';

export const CREATIVE_MAX_BYTES=8*1024*1024;
export const CREATIVE_ALLOWED_TYPES=Object.freeze(['image/png','image/jpeg','image/webp','image/gif']);
const BRIEF_SOURCES=Object.freeze(['growth','mari','custom']);

export function sniffImageType(bytes){
  const b=Buffer.from(bytes||[]);
  if(b.length>=8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47)return 'image/png';
  if(b.length>=3&&b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF)return 'image/jpeg';
  if(b.length>=6&&b[0]===0x47&&b[1]===0x49&&b[2]===0x46&&b[3]===0x38)return 'image/gif';
  if(b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'image/webp';
  return null;
}
export function creativeConfig(env=process.env){
  const dir=typeof env.CREATIVE_STORAGE_DIR==='string'&&env.CREATIVE_STORAGE_DIR?env.CREATIVE_STORAGE_DIR:'.data/creative';
  return {enabled:env.CREATIVE_GENERATION_ENABLED==='true',masterEnabled:env.META_REASONING_API_ENABLED==='true',keyConfigured:!!env.MODEL_API_KEY,storageDir:dir};
}
function validatedBrief(brief){
  if(brief===undefined||brief===null)return null;
  if(typeof brief!=='object')throw new Error('CREATIVE_BRIEF_INVALID');
  const source=brief.source===undefined||brief.source===null?'custom':String(brief.source);
  if(!BRIEF_SOURCES.includes(source))throw new Error('CREATIVE_BRIEF_INVALID');
  return {source,text:typeof brief.text==='string'?brief.text:'',businessName:brief.businessName,businessIndustry:brief.businessIndustry||''};
}
export async function generateCreativeAsset({tenant,brief,prompt,confirm,missionId,format,generateImpl=generateWithMuseImage,fetchMediaImpl,storeRoot,now=Date.now()}){
  const org=tenant&&typeof tenant.organizationId==='string'?tenant.organizationId.trim():'';
  const ws=tenant&&typeof tenant.workspaceId==='string'?tenant.workspaceId.trim():'';
  if(!org||!ws)throw new Error('CREATIVE_TENANT_REQUIRED');
  if(confirm!==true)throw new Error('CREATIVE_CONFIRM_REQUIRED');
  if(!storeRoot)throw new Error('CREATIVE_STORAGE_INVALID');
  const requested=resolveCreativeFormat(format===undefined||format===null?'square':format);
  const cleanBrief=validatedBrief(brief);
  const fallback=cleanBrief?{businessName:cleanBrief.businessName,businessIndustry:cleanBrief.businessIndustry,brief:cleanBrief.text,format:requested.id}:'';
  const finalPrompt=resolveCreativePrompt({prompt,fallback});
  if(finalPrompt.length>IMAGE_PROMPT_MAX_CHARS)throw new Error('CREATIVE_PROMPT_TOO_LONG');
  const gen=await generateImpl({prompt:finalPrompt});
  let bytes;
  let delivery;
  if(gen&&typeof gen.imageBase64==='string'&&gen.imageBase64){
    bytes=Buffer.from(gen.imageBase64,'base64');
    delivery='base64';
  }else if(gen&&typeof gen.imageUrl==='string'&&gen.imageUrl){
    if(!fetchMediaImpl)throw new Error('CREATIVE_FETCH_UNAVAILABLE');
    const media=await fetchMediaImpl(gen.imageUrl);
    bytes=Buffer.from((media&&media.bytes)||[]);
    delivery='url';
  }else{
    throw new Error('CREATIVE_EMPTY_RESULT');
  }
  if(bytes.length<1)throw new Error('CREATIVE_EMPTY_RESULT');
  if(bytes.length>CREATIVE_MAX_BYTES)throw new Error('CREATIVE_MEDIA_TOO_LARGE');
  const mimeType=sniffImageType(bytes);
  if(!mimeType||!CREATIVE_ALLOWED_TYPES.includes(mimeType))throw new Error('CREATIVE_MEDIA_TYPE_REJECTED');
  const metadata={
    schemaVersion:'1.0',
    assetId:mintAssetId(),
    organizationId:org,
    workspaceId:ws,
    missionId:String(missionId||'').slice(0,100)||null,
    prompt:finalPrompt,
    requestedFormat:{id:requested.id,label:requested.label,width:requested.width,height:requested.height},
    model:gen.model||null,
    requestId:gen.requestId||null,
    mimeType,
    bytes:bytes.length,
    sha256:sha256Hex(bytes),
    createdAt:new Date(Number(now)).toISOString(),
    delivery,
    reviewStatus:'PENDING_REVIEW',
    briefProvenance:{source:cleanBrief?cleanBrief.source:'custom',claimed:!!cleanBrief},
  };
  saveCreativeAsset(storeRoot,{organizationId:org,workspaceId:ws,metadata,bytes});
  return {metadata};
}
