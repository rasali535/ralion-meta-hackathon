import test from 'node:test';
import assert from 'node:assert/strict';
import {createBudgetLedger} from '../lib/budget.js';

const DAY_ONE=Date.UTC(2026,9,27,12,0,0);
const DAY_TWO=Date.UTC(2026,9,28,12,0,0);
const small=(over={})=>({dailyLimits:{spark:100,wonder:25,image:10,default:50,...over}});

test('reserves quota atomically with exact remaining counts',()=>{
  const ledger=createBudgetLedger(small({spark:2}));
  const first=ledger.reserve('ws-1',{model:'spark',now:DAY_ONE});
  assert.equal(first.newUsage,1);
  assert.equal(first.remainingUnits,1);
  assert.equal(first.dayKey,'2026-10-27');
  const second=ledger.reserve('ws-1',{model:'spark',now:DAY_ONE});
  assert.equal(second.remainingUnits,0);
  assert.throws(()=>ledger.reserve('ws-1',{model:'spark',now:DAY_ONE}),/BUDGET_EXCEEDED/);
});
test('confirms successes and releases failures',()=>{
  const ledger=createBudgetLedger(small({spark:1}));
  const receipt=ledger.reserve('ws-1',{model:'spark',now:DAY_ONE});
  assert.throws(()=>ledger.reserve('ws-1',{model:'spark',now:DAY_ONE}),/BUDGET_EXCEEDED/);
  const released=ledger.release(receipt);
  assert.equal(released.remainingUnits,1);
  const again=ledger.reserve('ws-1',{model:'spark',now:DAY_ONE});
  const confirmed=ledger.confirm(again,{requestId:'req_1'});
  assert.equal(confirmed.requestId,'req_1');
  assert.equal(confirmed.remainingUnits,0);
});
test('validates receipts, costs, and workspaces',()=>{
  const ledger=createBudgetLedger();
  assert.throws(()=>ledger.reserve('',{now:DAY_ONE}),/BUDGET_WORKSPACE_REQUIRED/);
  for(const cost of [0,-1,1.5,NaN,'x'])assert.throws(()=>ledger.reserve('ws-1',{costUnits:cost,now:DAY_ONE}),/BUDGET_COST_INVALID/,String(cost));
  assert.throws(()=>ledger.confirm(null),/BUDGET_RECEIPT_INVALID/);
  assert.throws(()=>ledger.confirm({}),/BUDGET_RECEIPT_INVALID/);
  assert.throws(()=>ledger.release(null),/BUDGET_RECEIPT_INVALID/);
  const harmless=ledger.release({workspaceId:'ghost',model:'spark',dayKey:'2026-10-27',costUnits:1});
  assert.equal(harmless.remainingUnits,100);
});
test('isolates models and rolls over daily',()=>{
  const ledger=createBudgetLedger(small({spark:1,wonder:1}));
  ledger.reserve('ws-1',{model:'spark',now:DAY_ONE});
  ledger.reserve('ws-1',{model:'wonder',now:DAY_ONE});
  assert.throws(()=>ledger.reserve('ws-1',{model:'spark',now:DAY_ONE}),/BUDGET_EXCEEDED/);
  const next=ledger.reserve('ws-1',{model:'spark',now:DAY_TWO});
  assert.equal(next.dayKey,'2026-10-28');
  assert.equal(next.remainingUnits,0);
});
