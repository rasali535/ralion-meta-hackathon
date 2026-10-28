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
export function checkInferenceAccess({presentedToken,mode='spark',env=process.env,buckets={minute:inferenceMinuteBucket,day:inferenceDayBucket},ledger=globalBudgetLedger,now=Date.now()}={}){
  if(!env.MODEL_API_KEY)throw httpError(503,{error:'Meta Model API is not configured on this deployment'});
  if(env.META_REASONING_API_ENABLED!=='true')throw httpError(403,{error:'Meta inference is disabled pending authenticated workspace access'});
  let access;
  try{
    access=verifyAccessToken(presentedToken,{staticToken:env.META_REASONING_ACCESS_TOKEN,hmacSecret:env.META_DEMO_TOKEN_SECRET,now});
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
