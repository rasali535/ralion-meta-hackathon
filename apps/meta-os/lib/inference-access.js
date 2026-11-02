/**
 * Shared guard for billable Meta inference routes.
 * Server-only. One decision point for key presence, master switch, token
 * authentication, tenant extraction, per-token rate limits, and per-tenant
 * budgets. Routes map thrown errors to HTTP; tests inject fakes.
 * Buckets and ledger are per-process memory, not durable or distributed.
 */
import {verifyAccessToken,tokenFingerprint,tenantContext} from './auth.js';
import {createRateLimiter} from './ratelimit.js';
import {globalBudgetLedger} from './budget.js';
import {isSessionRevoked,getFallbackDemoSecret} from './session.js';

export const inferenceMinuteBucket=createRateLimiter({capacity:10,refillIntervalMs:6000});
export const inferenceDayBucket=createRateLimiter({capacity:200,refillIntervalMs:432000});

export function httpError(status,body){
  const e=new Error((body&&body.error)||'Inference access denied');
  e.httpStatus=status;
  e.errorBody=body;
  return e;
}
export function tenantBudgetKey(organizationId,workspaceId){
  return String(organizationId)+'//'+String(workspaceId);
}
export function checkInferenceAccess({presentedToken,mode='spark',allowMock=false,env=process.env,buckets={minute:inferenceMinuteBucket,day:inferenceDayBucket},ledger=globalBudgetLedger,now=Date.now()}={}){
  const isMock=allowMock&&(env.MOCK_IMAGE_GENERATION==='true'||(!env.MODEL_API_KEY&&env.CREATIVE_GENERATION_ENABLED==='true'));
  if(!isMock&&!env.MODEL_API_KEY)throw httpError(503,{error:'Meta Model API is not configured on this deployment'});
  if(!isMock&&env.META_REASONING_API_ENABLED!=='true')throw httpError(403,{error:'Meta inference is disabled pending authenticated workspace access'});
  if(!presentedToken)throw httpError(401,{error:'Unauthorized'});
  if(isSessionRevoked(presentedToken))throw httpError(401,{error:'Session has been revoked'});
  let access;
  const isDemo=String(presentedToken).startsWith('v2.demo.')||String(presentedToken).startsWith('v2.org_demo.');
  const secret=env.META_DEMO_TOKEN_SECRET||(isDemo?getFallbackDemoSecret():undefined);
  try{
    access=verifyAccessToken(presentedToken,{staticToken:env.META_REASONING_ACCESS_TOKEN,hmacSecret:secret,now});
  }catch(e){
    if(String(e&&e.message)==='AUTH_NOT_CONFIGURED')throw httpError(503,{error:'Access control is not configured on this deployment'});
    throw httpError(401,{error:'Unauthorized'});
  }
  const tenant=tenantContext(access);
  const fp=tokenFingerprint(presentedToken);
  for(const bucket of [buckets.minute,buckets.day]){
    const r=bucket.check(fp,now);
    if(!r.allowed){const e=httpError(429,{error:'Rate limit exceeded'});e.retryAfterMs=r.retryAfterMs;throw e;}
  }
  const budget=ledger.checkBudget(tenantBudgetKey(tenant.organizationId,tenant.workspaceId),{model:mode,now});
  if(!budget.allowed)throw httpError(429,{error:'Workspace inference budget exceeded',remainingUnits:0});
  return {organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,fingerprint:fp,remainingBudget:budget.remainingUnits};
}
export function recordInferenceUsage({organizationId,workspaceId,mode='spark',requestId=null,now=Date.now(),ledger=globalBudgetLedger}={}){
  try{
    return ledger.recordUsage(tenantBudgetKey(organizationId,workspaceId),{model:mode,requestId,now});
  }catch(e){
    if(String(e&&e.message)==='BUDGET_EXCEEDED')throw httpError(429,{error:'Workspace inference budget exceeded',remainingUnits:0});
    throw e;
  }
}
export function reserveInferenceUsage({organizationId,workspaceId,mode='spark',now=Date.now(),ledger=globalBudgetLedger}={}){
  const tenant=tenantContext({organizationId,workspaceId});
  try{
    return ledger.reserve(tenantBudgetKey(tenant.organizationId,tenant.workspaceId),{model:mode,now});
  }catch(e){
    if(String(e&&e.message)==='BUDGET_EXCEEDED')throw httpError(429,{error:'Workspace inference budget exceeded',remainingUnits:0});
    throw e;
  }
}
export function settleInferenceUsage(receipt,{requestId=null,ok=true,ledger=globalBudgetLedger}={}){
  if(ok)return ledger.confirm(receipt,{requestId});
  return ledger.release(receipt);
}
export const LIVE_CAPABILITY_REASONS=Object.freeze(['LIVE_READY','KEY_MISSING','LIVE_DISABLED','UNAUTHENTICATED','SESSION_REVOKED','ACCESS_NOT_CONFIGURED','BUDGET_EXHAUSTED']);
// Read-only live-prerequisites probe for the status endpoint and the
// Settings one-click toggle. Reports flags, key presence, authentication,
// and per-mode budgets without consuming rate limits or reserving budget,
// so judges can check it freely before requesting live reasoning.
export function describeLiveCapability({presentedToken,env=process.env,ledger=globalBudgetLedger,now=Date.now()}={}){
  const keyConfigured=!!env.MODEL_API_KEY;
  const masterEnabled=env.META_REASONING_API_ENABLED==='true';
  const mariEnabled=env.MARI_LIVE_REASONING_ENABLED==='true';
  let tenant=null;
  let authReason=null;
  if(!presentedToken){authReason='UNAUTHENTICATED';}
  else if(isSessionRevoked(presentedToken)){authReason='SESSION_REVOKED';}
  else{
    const isDemo=String(presentedToken).startsWith('v2.demo.')||String(presentedToken).startsWith('v2.org_demo.');
    const secret=env.META_DEMO_TOKEN_SECRET||(isDemo?getFallbackDemoSecret():undefined);
    try{
      tenant=tenantContext(verifyAccessToken(presentedToken,{staticToken:env.META_REASONING_ACCESS_TOKEN,hmacSecret:secret,now}));
    }catch(e){
      authReason=String(e&&e.message)==='AUTH_NOT_CONFIGURED'?'ACCESS_NOT_CONFIGURED':'UNAUTHENTICATED';
    }
  }
  let budget=null;
  if(tenant){
    const key=tenantBudgetKey(tenant.organizationId,tenant.workspaceId);
    const slim=r=>({allowed:r.allowed===true,remainingUnits:r.remainingUnits,dailyLimit:r.dailyLimit});
    budget={spark:slim(ledger.checkBudget(key,{model:'spark',now})),wonder:slim(ledger.checkBudget(key,{model:'wonder',now}))};
  }
  let reason='LIVE_READY';
  if(!keyConfigured)reason='KEY_MISSING';
  else if(!masterEnabled||!mariEnabled)reason='LIVE_DISABLED';
  else if(authReason)reason=authReason;
  else if(budget&&!budget.spark.allowed&&!budget.wonder.allowed)reason='BUDGET_EXHAUSTED';
  return {
    keyConfigured,masterEnabled,mariEnabled,
    authenticated:tenant!==null,
    organizationId:tenant?tenant.organizationId:null,
    workspaceId:tenant?tenant.workspaceId:null,
    budget,
    ready:reason==='LIVE_READY',
    reason,
  };
}
