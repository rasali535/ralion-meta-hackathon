import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveInferenceUsage,settleInferenceUsage} from '../lib/inference-access.js';

function ledgerStub(){
  const calls=[];
  return {calls,
    reserve:(ws,opts)=>{calls.push({op:'reserve',ws,model:opts&&opts.model});if(ws==='org-1//ws-full')throw new Error('BUDGET_EXCEEDED');return {workspaceId:ws,model:opts&&opts.model,dayKey:'2026-10-27',costUnits:1,newUsage:1,remainingUnits:99,dailyLimit:100};},
    confirm:(r,opts)=>{calls.push({op:'confirm',requestId:opts&&opts.requestId});return {...r,requestId:(opts&&opts.requestId)||null};},
    release:(r)=>{calls.push({op:'release'});return {remainingUnits:100};}};
}

test('reserves against the tenant composite key',()=>{
  const led=ledgerStub();
  const r=reserveInferenceUsage({organizationId:'org-1',workspaceId:'ws-1',mode:'image',ledger:led});
  assert.equal(r.remainingUnits,99);
  assert.equal(led.calls[0].ws,'org-1//ws-1');
  assert.equal(led.calls[0].model,'image');
});
test('maps exhaustion to 429 and validates tenant',()=>{
  const led=ledgerStub();
  try{reserveInferenceUsage({organizationId:'org-1',workspaceId:'ws-full',ledger:led});assert.fail('must throw');}
  catch(e){assert.equal(e.httpStatus,429);}
  assert.throws(()=>reserveInferenceUsage({organizationId:'',workspaceId:'ws-1',ledger:led}),/AUTH_TENANT_REQUIRED/);
});
test('settles successes and releases failures',()=>{
  const led=ledgerStub();
  const r=reserveInferenceUsage({organizationId:'org-1',workspaceId:'ws-1',ledger:led});
  const ok=settleInferenceUsage(r,{requestId:'req_9',ledger:led});
  assert.equal(ok.requestId,'req_9');
  const rel=settleInferenceUsage(r,{ok:false,ledger:led});
  assert.equal(rel.remainingUnits,100);
  assert.deepEqual(led.calls.map(c=>c.op),['reserve','confirm','release']);
});
