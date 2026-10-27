import test from 'node:test';
import assert from 'node:assert/strict';
import {checkInferenceAccess,recordInferenceUsage,tenantBudgetKey,httpError} from '../lib/inference-access.js';
import {issueDemoToken} from '../lib/auth.js';
import {createRateLimiter} from '../lib/ratelimit.js';

const SECRET='test-secret-with-32-plus-characters!!';
const NOW=1761600000000;
function env(over={}){return {MODEL_API_KEY:'k',META_REASONING_API_ENABLED:'true',META_DEMO_TOKEN_SECRET:SECRET,...over};}
function buckets(){return {minute:createRateLimiter({capacity:10,refillIntervalMs:6000,clock:()=>NOW}),day:createRateLimiter({capacity:200,refillIntervalMs:432000,clock:()=>NOW})};}
function ledgerStub({allowed=true,remainingUnits=99,recordImpl}={}){
  const calls=[];
  return {calls,
    checkBudget:(ws,opts)=>{calls.push({op:'check',ws,model:opts&&opts.model});return {allowed,remainingUnits,dailyLimit:100};},
    recordUsage:(ws,opts)=>{calls.push({op:'record',ws,model:opts&&opts.model,requestId:opts&&opts.requestId});if(recordImpl)return recordImpl(ws,opts);return {remainingUnits:remainingUnits-1};}};
}
function token(){return issueDemoToken('ws-1',{organizationId:'org-1',hmacSecret:SECRET,now:NOW});}
function catchErr(fn){try{fn();}catch(e){return e;}throw new Error('DID_NOT_THROW');}

test('denies unconfigured, disabled, and unauthenticated requests',()=>{
  const led=ledgerStub();
  let e=catchErr(()=>checkInferenceAccess({presentedToken:token(),env:env({MODEL_API_KEY:''}),buckets:buckets(),ledger:led,now:NOW}));
  assert.equal(e.httpStatus,503);
  e=catchErr(()=>checkInferenceAccess({presentedToken:token(),env:env({META_REASONING_API_ENABLED:'false'}),buckets:buckets(),ledger:led,now:NOW}));
  assert.equal(e.httpStatus,403);
  e=catchErr(()=>checkInferenceAccess({presentedToken:'bogus',env:env(),buckets:buckets(),ledger:led,now:NOW}));
  assert.equal(e.httpStatus,401);
  e=catchErr(()=>checkInferenceAccess({presentedToken:'bogus',env:{MODEL_API_KEY:'k',META_REASONING_API_ENABLED:'true'},buckets:buckets(),ledger:led,now:NOW}));
  assert.equal(e.httpStatus,503);
  assert.equal(led.calls.length,0);
});
test('returns tenant context and keys budgets by organization and workspace',()=>{
  const led=ledgerStub();
  const r=checkInferenceAccess({presentedToken:token(),mode:'wonder',env:env(),buckets:buckets(),ledger:led,now:NOW});
  assert.equal(r.organizationId,'org-1');
  assert.equal(r.workspaceId,'ws-1');
  assert.match(r.fingerprint,/^fp_[0-9a-f]{16}$/);
  assert.equal(r.remainingBudget,99);
  assert.equal(led.calls.length,1);
  assert.equal(led.calls[0].ws,'org-1//ws-1');
  assert.equal(led.calls[0].model,'wonder');
});
test('accepts the static integration tenant',()=>{
  const led=ledgerStub();
  const r=checkInferenceAccess({presentedToken:'static-int-1',env:env({META_REASONING_ACCESS_TOKEN:'static-int-1'}),buckets:buckets(),ledger:led,now:NOW});
  assert.equal(r.organizationId,'integration');
  assert.equal(led.calls[0].ws,'integration//integration');
});
test('enforces rate limits with retry-after before budgets',()=>{
  const tight={minute:createRateLimiter({capacity:1,refillIntervalMs:60000,clock:()=>NOW}),day:createRateLimiter({capacity:200,refillIntervalMs:432000,clock:()=>NOW})};
  const led=ledgerStub();
  checkInferenceAccess({presentedToken:token(),env:env(),buckets:tight,ledger:led,now:NOW});
  const e=catchErr(()=>checkInferenceAccess({presentedToken:token(),env:env(),buckets:tight,ledger:led,now:NOW}));
  assert.equal(e.httpStatus,429);
  assert.equal(e.errorBody.error,'Rate limit exceeded');
  assert.ok(e.retryAfterMs>0);
  assert.equal(led.calls.filter(c=>c.op==='check').length,1);
});
test('enforces budget exhaustion with zero remaining',()=>{
  const led=ledgerStub({allowed:false,remainingUnits:0});
  const e=catchErr(()=>checkInferenceAccess({presentedToken:token(),env:env(),buckets:buckets(),ledger:led,now:NOW}));
  assert.equal(e.httpStatus,429);
  assert.equal(e.errorBody.remainingUnits,0);
});
test('records usage and maps budget races to 429',()=>{
  const led=ledgerStub({remainingUnits:50});
  const usage=recordInferenceUsage({organizationId:'org-1',workspaceId:'ws-1',mode:'spark',requestId:'r1',now:NOW,ledger:led});
  assert.equal(usage.remainingUnits,49);
  assert.equal(led.calls[0].ws,'org-1//ws-1');
  assert.equal(led.calls[0].requestId,'r1');
  const racing=ledgerStub({recordImpl:()=>{throw new Error('BUDGET_EXCEEDED');}});
  const e=catchErr(()=>recordInferenceUsage({organizationId:'org-1',workspaceId:'ws-1',ledger:racing}));
  assert.equal(e.httpStatus,429);
  const broken=ledgerStub({recordImpl:()=>{throw new Error('DISK_GONE');}});
  const other=catchErr(()=>recordInferenceUsage({organizationId:'org-1',workspaceId:'ws-1',ledger:broken}));
  assert.equal(other.message,'DISK_GONE');
});
test('exposes stable helpers',()=>{
  assert.equal(tenantBudgetKey('o','w'),'o//w');
  const e=httpError(418,{error:'teapot'});
  assert.equal(e.httpStatus,418);
  assert.equal(e.errorBody.error,'teapot');
});
