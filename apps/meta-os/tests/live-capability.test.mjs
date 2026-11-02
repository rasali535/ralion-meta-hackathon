import test from 'node:test';
import assert from 'node:assert/strict';
import {describeLiveCapability,LIVE_CAPABILITY_REASONS} from '../lib/inference-access.js';
import {issueDemoToken} from '../lib/auth.js';
import {revokeSession} from '../lib/session.js';

const SECRET='test-secret-with-32-plus-characters!!';
const NOW=1761600000000;
function env(over={}){return {MODEL_API_KEY:'k',META_REASONING_API_ENABLED:'true',MARI_LIVE_REASONING_ENABLED:'true',META_DEMO_TOKEN_SECRET:SECRET,...over};}
function ledgerStub({spark={allowed:true,remainingUnits:100,dailyLimit:100},wonder={allowed:true,remainingUnits:25,dailyLimit:25}}={}){
  const calls=[];
  return {calls,checkBudget:(ws,opts)=>{const m=opts&&opts.model==='wonder'?wonder:spark;calls.push({op:'check',ws,model:opts&&opts.model});return {allowed:m.allowed,remainingUnits:m.remainingUnits,dailyLimit:m.dailyLimit};}};
}
function token(ws='ws-1'){return issueDemoToken(ws,{organizationId:'org-1',hmacSecret:SECRET,now:NOW});}

test('reports LIVE_READY with flags, key, token, and per-mode budgets',()=>{
  const led=ledgerStub();
  const r=describeLiveCapability({presentedToken:token(),env:env(),ledger:led,now:NOW});
  assert.equal(r.reason,'LIVE_READY');
  assert.equal(r.ready,true);
  assert.equal(r.keyConfigured,true);
  assert.equal(r.masterEnabled,true);
  assert.equal(r.mariEnabled,true);
  assert.equal(r.authenticated,true);
  assert.equal(r.organizationId,'org-1');
  assert.equal(r.workspaceId,'ws-1');
  assert.deepEqual(r.budget.spark,{allowed:true,remainingUnits:100,dailyLimit:100});
  assert.deepEqual(r.budget.wonder,{allowed:true,remainingUnits:25,dailyLimit:25});
  assert.deepEqual(led.calls.map(c=>c.model),['spark','wonder']);
  assert.equal(led.calls[0].ws,'org-1//ws-1');
  assert.ok(LIVE_CAPABILITY_REASONS.includes(r.reason));
});

test('reports KEY_MISSING without a server key but still shows budgets',()=>{
  const led=ledgerStub();
  const r=describeLiveCapability({presentedToken:token(),env:env({MODEL_API_KEY:''}),ledger:led,now:NOW});
  assert.equal(r.reason,'KEY_MISSING');
  assert.equal(r.ready,false);
  assert.equal(r.keyConfigured,false);
  assert.equal(r.authenticated,true);
  assert.ok(r.budget&&r.budget.spark.remainingUnits===100);
});

test('reports LIVE_DISABLED when either inference flag is off',()=>{
  let r=describeLiveCapability({presentedToken:token(),env:env({META_REASONING_API_ENABLED:'false'}),ledger:ledgerStub(),now:NOW});
  assert.equal(r.reason,'LIVE_DISABLED');
  assert.equal(r.masterEnabled,false);
  r=describeLiveCapability({presentedToken:token(),env:env({MARI_LIVE_REASONING_ENABLED:'false'}),ledger:ledgerStub(),now:NOW});
  assert.equal(r.reason,'LIVE_DISABLED');
  assert.equal(r.mariEnabled,false);
  assert.equal(r.ready,false);
});

test('reports UNAUTHENTICATED without a usable token and hides budgets',()=>{
  const led=ledgerStub();
  let r=describeLiveCapability({presentedToken:null,env:env(),ledger:led,now:NOW});
  assert.equal(r.reason,'UNAUTHENTICATED');
  assert.equal(r.authenticated,false);
  assert.equal(r.budget,null);
  r=describeLiveCapability({presentedToken:'bogus',env:env(),ledger:led,now:NOW});
  assert.equal(r.reason,'UNAUTHENTICATED');
  assert.equal(r.budget,null);
  r=describeLiveCapability({presentedToken:'bogus',env:{MODEL_API_KEY:'k',META_REASONING_API_ENABLED:'true',MARI_LIVE_REASONING_ENABLED:'true'},ledger:led,now:NOW});
  assert.equal(r.reason,'ACCESS_NOT_CONFIGURED');
  assert.equal(led.calls.length,0);
});

test('reports SESSION_REVOKED for revoked tokens',()=>{
  const t=token('ws-revoked-1');
  revokeSession(t);
  const r=describeLiveCapability({presentedToken:t,env:env(),ledger:ledgerStub(),now:NOW});
  assert.equal(r.reason,'SESSION_REVOKED');
  assert.equal(r.authenticated,false);
  assert.equal(r.budget,null);
});

test('reports BUDGET_EXHAUSTED only when both modes are spent',()=>{
  const spent=ledgerStub({spark:{allowed:false,remainingUnits:0,dailyLimit:100},wonder:{allowed:false,remainingUnits:0,dailyLimit:25}});
  let r=describeLiveCapability({presentedToken:token(),env:env(),ledger:spent,now:NOW});
  assert.equal(r.reason,'BUDGET_EXHAUSTED');
  assert.equal(r.ready,false);
  const partial=ledgerStub({spark:{allowed:true,remainingUnits:3,dailyLimit:100},wonder:{allowed:false,remainingUnits:0,dailyLimit:25}});
  r=describeLiveCapability({presentedToken:token(),env:env(),ledger:partial,now:NOW});
  assert.equal(r.reason,'LIVE_READY');
  assert.equal(r.ready,true);
});

test('probe is read-only: repeated calls never consume budget',()=>{
  const led=ledgerStub({spark:{allowed:true,remainingUnits:7,dailyLimit:100},wonder:{allowed:true,remainingUnits:2,dailyLimit:25}});
  const a=describeLiveCapability({presentedToken:token(),env:env(),ledger:led,now:NOW});
  const b=describeLiveCapability({presentedToken:token(),env:env(),ledger:led,now:NOW});
  assert.deepEqual(a.budget,b.budget);
  assert.ok(led.calls.length>0&&led.calls.every(c=>c.op==='check'));
});

test('accepts the static integration tenant',()=>{
  const led=ledgerStub();
  const r=describeLiveCapability({presentedToken:'static-int-1',env:env({META_REASONING_ACCESS_TOKEN:'static-int-1'}),ledger:led,now:NOW});
  assert.equal(r.reason,'LIVE_READY');
  assert.equal(r.organizationId,'integration');
  assert.equal(led.calls[0].ws,'integration//integration');
});
