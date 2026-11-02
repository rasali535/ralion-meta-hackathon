/**
 * Modal sandbox execution client for dispatch receipts. Server-only.
 * Posts the canonical dispatch bundle to the app operator's Modal web
 * endpoint (modal/dispatch_executor.py) and returns the independent
 * execution attestation. No secrets cross this boundary: the payload is
 * the bundle JSON plus its claimed hash, and HMAC keys / Modal API tokens
 * never leave this server. Inject fetchImpl for tests; never call live
 * Modal from tests.
 */
export const MODAL_EXECUTOR='modal-sandbox';
export const MODAL_TIMEOUT_MS=20000;
export const MODAL_MAX_ERROR_LEN=80;

export function modalDispatchConfig(env=process.env){
  const url=typeof env.MODAL_DISPATCH_URL==='string'?env.MODAL_DISPATCH_URL.trim():'';
  const flagRaw=typeof env.MODAL_SANDBOX_ENABLED==='string'?env.MODAL_SANDBOX_ENABLED.trim().toLowerCase():'';
  const flagDisabled=flagRaw==='false'||flagRaw==='0'||flagRaw==='off';
  return {enabled:!flagDisabled&&url.startsWith('https://'),endpointUrl:url};
}
export function modalAuthConfig(env=process.env){
  const tokenId=typeof env.MODAL_TOKEN_ID==='string'?env.MODAL_TOKEN_ID.trim():'';
  const tokenSecret=typeof env.MODAL_TOKEN_SECRET==='string'?env.MODAL_TOKEN_SECRET.trim():'';
  const dispatch=modalDispatchConfig(env);
  const flagRaw=typeof env.MODAL_SANDBOX_ENABLED==='string'?env.MODAL_SANDBOX_ENABLED.trim().toLowerCase():'';
  const sandboxEnabled=flagRaw?flagRaw==='true':dispatch.enabled;
  return {
    sandboxEnabled,
    enabled:dispatch.enabled,
    authConfigured:Boolean(tokenId&&tokenSecret),
    tokenIdPresent:Boolean(tokenId),
    tokenSecretPresent:Boolean(tokenSecret),
    endpointConfigured:dispatch.endpointUrl.startsWith('https://'),
  };
}
export function sanitizeModalErrorCode(e){
  const m=String(e&&e.message||'');
  if(/^MODAL_[A-Z0-9_]{1,60}$/.test(m))return m;
  return 'MODAL_SANDBOX_FAILED';
}
export async function executeInModalSandbox(payload,{endpointUrl,fetchImpl=fetch,timeoutMs=MODAL_TIMEOUT_MS}={}){
  if(!endpointUrl||!String(endpointUrl).startsWith('https://'))throw new Error('MODAL_ENDPOINT_NOT_CONFIGURED');
  if(!payload||typeof payload!=='object'||typeof payload.bundleJson!=='string'||!payload.bundleJson)throw new Error('MODAL_BUNDLE_INVALID');
  const safeBody={bundleJson:String(payload.bundleJson)};
  if(typeof payload.claimedBundleHash==='string'&&payload.claimedBundleHash){
    safeBody.claimedBundleHash=String(payload.claimedBundleHash);
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    let res;
    try{
      res=await fetchImpl(endpointUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(safeBody),signal:controller.signal});
    }catch(e){
      if(e&&e.name==='AbortError')throw new Error('MODAL_REQUEST_TIMEOUT');
      throw new Error('MODAL_REQUEST_FAILED');
    }
    if(!res||!res.ok)throw new Error('MODAL_SANDBOX_ERROR_'+(res&&res.status?res.status:'UNKNOWN'));
    const data=await res.json().catch(()=>null);
    if(!data||data.ok!==true)throw new Error('MODAL_SANDBOX_REJECTED');
    if(typeof data.executionId!=='string'||!data.executionId)throw new Error('MODAL_EXECUTION_INVALID');
    return {
      executionId:String(data.executionId).slice(0,80),
      executor:MODAL_EXECUTOR,
      bundleHashVerified:data.bundleHashVerified===true,
      checks:data.checks&&typeof data.checks==='object'?data.checks:{},
      packagedAt:String(data.packagedAt||'').slice(0,40),
    };
  }finally{clearTimeout(timer);}
}
