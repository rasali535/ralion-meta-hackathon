import test from 'node:test';
import assert from 'node:assert/strict';
import {planMission,attachApproval} from '../lib/mission.js';
import {recordHumanApproval} from '../lib/approval.js';

const SECRET='approval-test-secret-32-chars-min!!';
const base={name:'Northstar Coffee',industry:'Hospitality / coffee',objective:'Increase morning customer visits'};
function mint(mission,over={}){
  return recordHumanApproval(mission,{actorId:'u-1',role:'owner',organizationId:'org-1',workspaceId:'ws-1',hmacSecret:SECRET,...over});
}
function ctx(over={}){return {expectedOrganizationId:'org-1',expectedWorkspaceId:'ws-1',hmacSecret:SECRET,...over};}

test('attaches a verified approval without touching execution',()=>{
  const mission=planMission(base);
  const out=attachApproval(mission,{record:mint(mission),...ctx()});
  assert.equal(out.approval.status,'APPROVED');
  assert.equal(out.approval.verified,true);
  assert.equal(out.approval.scope,'LOCAL_DRAFT_ONLY');
  assert.deepEqual(out.approval.actor,{id:'u-1',role:'owner'});
  assert.ok(out.approval.planHash.length===64);
  assert.equal(out.execution.status,'NOT_CONNECTED');
  assert.equal(out.execution.receipt,null);
});
test('records rejections explicitly',()=>{
  const mission=planMission(base);
  const out=attachApproval(mission,{record:mint(mission,{decision:'REJECTED'}),...ctx()});
  assert.equal(out.approval.status,'REJECTED');
  assert.equal(out.execution.status,'NOT_CONNECTED');
});
test('rejects tampered plans, wrong secrets, and tenant mismatches',()=>{
  const mission=planMission(base);
  const record=mint(mission);
  const tampered={...mission,social:[{channel:'Facebook',copy:'Hacked copy'}]};
  assert.throws(()=>attachApproval(tampered,{record,...ctx()}),/APPROVAL_RECORD_INVALID/);
  assert.throws(()=>attachApproval(mission,{record,...ctx({hmacSecret:'wrong-secret-00000000000000000'})}),/APPROVAL_RECORD_INVALID/);
  assert.throws(()=>attachApproval(mission,{record,...ctx({expectedWorkspaceId:'ws-2'})}),/APPROVAL_TENANT_MISMATCH/);
  assert.throws(()=>attachApproval(mission,{record:{...record,scope:'PUBLISH'},...ctx()}),/APPROVAL_SCOPE_UNAUTHORIZED/);
});
test('rejects malformed attach requests',()=>{
  const mission=planMission(base);
  assert.throws(()=>attachApproval(null,{record:{},...ctx()}),/APPROVAL_INVALID_MISSION/);
  assert.throws(()=>attachApproval(mission,{record:null,...ctx()}),/APPROVAL_RECORD_INVALID/);
  assert.throws(()=>attachApproval(mission,{record:mint(mission),...ctx({hmacSecret:''})}),/APPROVAL_SECRET_REQUIRED/);
  assert.throws(()=>attachApproval(mission,{record:mint(mission),...ctx({expectedOrganizationId:''})}),/APPROVAL_TENANT_REQUIRED/);
});
test('approval can never enable execution',()=>{
  const mission={...planMission(base),execution:{status:'CONNECTED',receipt:'x'}};
  const out=attachApproval(mission,{record:mint(mission),...ctx()});
  assert.equal(out.execution.status,'NOT_CONNECTED');
});
