/**
 * MARI live-diagnosis adapter.
 * Server-only. Thin, injectable wrapper over the Meta reasoning provider:
 * resolves the requested mode, caps output for mission payloads, and labels
 * every response as model output grounded only in unverified user claims.
 * Inject reasonImpl for tests; never call billable inference from tests.
 */
import {reasonWithMeta} from './meta/provider.js';

export const MARI_MODES=Object.freeze(['spark','wonder']);
export const MARI_MAX_OUTPUT_CHARS=4000;
export const MARI_CLAIMS_SOURCE='META_MODEL_OUTPUT_FROM_UNVERIFIED_CLAIMS';

export function missionLiveConfig(env=process.env){
  return {liveRequested:env.MARI_LIVE_REASONING_ENABLED==='true',masterEnabled:env.META_REASONING_API_ENABLED==='true',keyConfigured:!!env.MODEL_API_KEY};
}
export function resolveMariMode(raw){
  if(raw===undefined||raw===null||raw==='')return 'spark';
  if(raw==='spark'||raw==='wonder')return raw;
  throw new Error('MARI_MODE_INVALID');
}
export function sanitizeMariErrorCode(e){
  const m=String(e&&e.message||'');
  if(/^(META_[A-Z0-9_]+|BUSINESS_CONTEXT_REQUIRED|UNSUPPORTED_REASONING_MODEL|MARI_[A-Z0-9_]+|BUDGET_EXCEEDED)$/.test(m))return m;
  return 'MARI_DIAGNOSIS_FAILED';
}
export async function diagnoseWithMari(business,{mode='spark',reasonImpl=reasonWithMeta}={}){
  const m=resolveMariMode(mode);
  const result=await reasonImpl({business,mode:m});
  const output=result&&typeof result.output==='string'?result.output:'';
  if(!output)throw new Error('MARI_EMPTY_DIAGNOSIS');
  return {source:MARI_CLAIMS_SOURCE,mode:m,model:result.model||null,output:output.slice(0,MARI_MAX_OUTPUT_CHARS),requestId:result.requestId||null};
}
