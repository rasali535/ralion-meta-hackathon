/**
 * Ralion portable Meta Model API transport.
 * Server-only. Fixed Meta host; never accept caller-defined URL or model ID.
 * No key in browser, logs or response. Inject fetch for contract tests.
 */
export const META_API_BASE='https://api.meta.ai/v1';
export const MODEL_IDS=Object.freeze({spark:'muse-spark-1.3',wonder:'muse-wonder-1.0',image:'muse-image-1.0',segment:'sam-3.1'});
export function modelConfig(env=process.env){return {configured:!!env.MODEL_API_KEY,models:MODEL_IDS};}
export async function metaRequest(endpoint,payload,{key=process.env.MODEL_API_KEY,fetchImpl=fetch,timeoutMs=25000}={}){
 if(!key)throw new Error('META_MODEL_NOT_CONFIGURED');
 if(!['/responses','/images/generations'].includes(endpoint))throw new Error('META_ENDPOINT_NOT_ALLOWED');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetchImpl(META_API_BASE+endpoint,{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
  if(!response.ok)throw new Error('META_MODEL_REQUEST_FAILED_'+response.status);
  return await response.json();
 }finally{clearTimeout(timer)}
}
export function responseText(value){
 if(typeof value?.output_text==='string')return value.output_text;
 const texts=[];
 for(const item of value?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')texts.push(c.text);
 return texts.join('\n').trim();
}
export async function reasonWithMeta({business,task='growth',mode='spark',fetchImpl,key}){
 if(!['spark','wonder'].includes(mode))throw new Error('UNSUPPORTED_REASONING_MODEL');
 const facts={name:String(business?.name||'').slice(0,100),industry:String(business?.industry||'').slice(0,100),objective:String(business?.objective||'').slice(0,300),audience:String(business?.audience||'').slice(0,200),facts:String(business?.facts||'').slice(0,2000)};
 if(!facts.name||!facts.objective)throw new Error('BUSINESS_CONTEXT_REQUIRED');
 const system='You are MARI in Ralion OS. Analyze only supplied user claims as unverified information. Never claim to have crawled websites, fetched ad metrics, generated images or executed campaigns. Propose a specific testable campaign opportunity. Return concise plain text with an insight, hypothesis, suggested action and success metric. Require explicit human approval before any external action.';
 const result=await metaRequest('/responses',{model:MODEL_IDS[mode],input:[{role:'system',content:system},{role:'user',content:JSON.stringify({task,business:facts})}]},{key,fetchImpl});
 const output=responseText(result);if(!output)throw new Error('META_EMPTY_MODEL_RESPONSE');
 return {provider:'META_MODEL_API',model:MODEL_IDS[mode],output,requestId:result.id||null,mode,claimsSource:'USER_SUPPLIED_UNVERIFIED'};
}
export async function generateWithMuseImage({prompt,fetchImpl,key}){
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>2500)throw new Error('INVALID_IMAGE_PROMPT');
 const result=await metaRequest('/images/generations',{model:MODEL_IDS.image,prompt:prompt.trim(),n:1,response_format:'url'},{key,fetchImpl,timeoutMs:60000});
 const image=result?.data?.[0];if(!image?.url&&!image?.b64_json)throw new Error('META_EMPTY_IMAGE_RESPONSE');
 return {provider:'META_MODEL_API',model:MODEL_IDS.image,imageUrl:image.url||null,imageBase64:image.b64_json||null,reviewRequired:true};
}
