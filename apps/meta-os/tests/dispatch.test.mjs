import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {rmSync,mkdirSync} from 'node:fs';
import {planMission,mintMissionApproval} from '../lib/mission.js';
import {buildLearningLoop} from '../lib/learning-loop.js';
import {buildDispatchReceipt,dispatchPaths,findReceiptForApproval,listDispatchReceipts,loadDispatchReceipt,mintDispatchId,saveDispatchReceipt,verifyDispatchReceipt} from '../lib/dispatch.js';

const TMP=path.join(import.meta.dirname,'.tmp','dispatch');
function fresh(){rmSync(TMP,{recursive:true,force:true});mkdirSync(TMP,{recursive:true});}
after(()=>rmSync(TMP,{recursive:true,force:true}));
const SECRET='dispatch-flow-test-secret-32-chars!';
const base={name:'Northstar Coffee',industry:'Hospitality / coffee',objective:'Increase morning customer visits'};
const tenant={organizationId:'org-1',workspaceId:'ws-1'};
function approved(){
  const mission=planMission(base);
  const approval=mintMissionApproval(mission,{actorId:'alice',role:'marketing_lead',organizationId:'org-1',workspaceId:'ws-1',hmacSecret:SECRET});
  return {mission,approval};
}

test('mints signed, verifiable sandbox receipts for approved missions',()=>{
  const {mission,approval}=approved();
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET,now:'2026-11-02T12:00:00.000Z'});
  assert.match(receipt.dispatchId,/^dsp_[0-9a-f]{16}$/);
  assert.match(mintDispatchId(),/^dsp_[0-9a-f]{16}$/);
  assert.equal(receipt.missionId,mission.missionId);
  assert.equal(receipt.execution,'SANDBOX_EXPORT_ONLY');
  assert.equal(receipt.publishStatus,'NOT_CONNECTED');
  assert.equal(receipt.approval.planHash,approval.planHash);
  assert.equal(receipt.channels.length,2);
  assert.match(receipt.bundleHash,/^[0-9a-f]{64}$/);
  assert.ok(Number.isFinite(receipt.approvalLatencyMs));
  assert.equal(verifyDispatchReceipt(receipt,{hmacSecret:SECRET}),true);
  assert.equal(verifyDispatchReceipt(receipt,{hmacSecret:'wrong-secret'}),false);
});

test('rejects post-approval edits via plan-hash binding',()=>{
  const {mission,approval}=approved();
  const tampered={...mission,social:mission.social.map((s,i)=>i===0?{...s,caption:'Sneaky edited caption'}:s)};
  assert.throws(()=>buildDispatchReceipt({mission:tampered,approval,tenant,hmacSecret:SECRET}),/DISPATCH_PLAN_TAMPERED/);
  const forged={...approval,planHash:'0'.repeat(64)};
  assert.throws(()=>buildDispatchReceipt({mission,approval:forged,tenant,hmacSecret:SECRET}),/DISPATCH_PLAN_TAMPERED/);
});

test('dispatches approved decisions only, within the same tenant and mission',()=>{
  const {mission,approval}=approved();
  const rejected=mintMissionApproval(mission,{actorId:'alice',role:'owner',decision:'REJECTED',organizationId:'org-1',workspaceId:'ws-1',hmacSecret:SECRET});
  assert.throws(()=>buildDispatchReceipt({mission,approval:rejected,tenant,hmacSecret:SECRET}),/DISPATCH_DECISION_NOT_APPROVED/);
  assert.throws(()=>buildDispatchReceipt({mission,approval,tenant:{organizationId:'org-1',workspaceId:'ws-2'},hmacSecret:SECRET}),/DISPATCH_APPROVAL_TENANT_MISMATCH/);
  const other=planMission(base);
  assert.throws(()=>buildDispatchReceipt({mission:other,approval,tenant,hmacSecret:SECRET}),/DISPATCH_APPROVAL_MISSION_MISMATCH/);
  assert.throws(()=>buildDispatchReceipt({mission,approval:{...approval,scope:'PUBLISH_LIVE'},tenant,hmacSecret:SECRET}),/DISPATCH_SCOPE_UNAUTHORIZED/);
});

test('rejects forged or altered receipts on verification',()=>{
  const {mission,approval}=approved();
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET});
  assert.equal(verifyDispatchReceipt({...receipt,signature:'0'.repeat(64)},{hmacSecret:SECRET}),false);
  assert.equal(verifyDispatchReceipt({...receipt,channels:[...receipt.channels,{channel:'facebook',caption:'Injected',cta:'',hashtags:[]}]},{hmacSecret:SECRET}),false);
  assert.equal(verifyDispatchReceipt({...receipt,execution:'PUBLISH_LIVE'},{hmacSecret:SECRET}),false);
  assert.equal(verifyDispatchReceipt(null,{hmacSecret:SECRET}),false);
  assert.equal(verifyDispatchReceipt(receipt,{}),false);
});

test('persists receipts per tenant with isolated listing and loading',()=>{
  fresh();
  const {mission,approval}=approved();
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET});
  saveDispatchReceipt(TMP,{organizationId:'org-1',workspaceId:'ws-1',receipt});
  const back=loadDispatchReceipt(TMP,{organizationId:'org-1',workspaceId:'ws-1',dispatchId:receipt.dispatchId});
  assert.equal(back.bundleHash,receipt.bundleHash);
  assert.equal(verifyDispatchReceipt(back,{hmacSecret:SECRET}),true);
  assert.equal(listDispatchReceipts(TMP,{organizationId:'org-1',workspaceId:'ws-1'}).length,1);
  assert.deepEqual(listDispatchReceipts(TMP,{organizationId:'org-1',workspaceId:'ws-2'}),[]);
  assert.deepEqual(listDispatchReceipts(TMP,{organizationId:'org-9',workspaceId:'ws-1'}),[]);
  assert.throws(()=>loadDispatchReceipt(TMP,{organizationId:'org-1',workspaceId:'ws-2',dispatchId:receipt.dispatchId}),/DISPATCH_RECEIPT_MISSING/);
  assert.throws(()=>saveDispatchReceipt(TMP,{organizationId:'org-1',workspaceId:'ws-2',receipt}),/DISPATCH_TENANT_MISMATCH/);
});

test('finds existing receipts per approval for idempotent re-dispatch',()=>{
  fresh();
  const {mission,approval}=approved();
  assert.equal(findReceiptForApproval(TMP,{organizationId:'org-1',workspaceId:'ws-1',approvalId:approval.approvalId}),null);
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET});
  saveDispatchReceipt(TMP,{organizationId:'org-1',workspaceId:'ws-1',receipt});
  const found=findReceiptForApproval(TMP,{organizationId:'org-1',workspaceId:'ws-1',approvalId:approval.approvalId});
  assert.equal(found.dispatchId,receipt.dispatchId);
  assert.equal(findReceiptForApproval(TMP,{organizationId:'org-1',workspaceId:'ws-2',approvalId:approval.approvalId}),null);
});

test('rejects path escape in tenant segments and receipt ids',()=>{
  assert.throws(()=>dispatchPaths(TMP,'../evil','ws-1','dsp_0123456789abcdef'),/DISPATCH_ORG_INVALID/);
  assert.throws(()=>dispatchPaths(TMP,'org-1','ws-1','../../x'),/DISPATCH_ID_INVALID/);
  assert.throws(()=>dispatchPaths('', 'org-1','ws-1','dsp_0123456789abcdef'),/DISPATCH_STORAGE_INVALID/);
  assert.throws(()=>saveDispatchReceipt(TMP,{organizationId:'org-1',workspaceId:'ws-1',receipt:null}),/DISPATCH_RECEIPT_INVALID/);
});

test('learning loop reports sandbox exports without inventing publishing',()=>{
  const {mission,approval}=approved();
  mission.approval={status:'APPROVED',actor:{id:'alice',role:'marketing_lead'},planHash:approval.planHash,approvedAt:approval.approvedAt};
  const bare=buildLearningLoop(mission);
  assert.equal(bare.dispatch.status,'NOT_DISPATCHED');
  assert.equal(bare.dispatch.count,0);
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET});
  const loop=buildLearningLoop(mission,{dispatches:[receipt,{...receipt,dispatchId:'dsp_ffffffffffffffff',missionId:'other-mission'}]});
  assert.equal(loop.dispatch.status,'SANDBOX_EXPORTED');
  assert.equal(loop.dispatch.count,1);
  assert.equal(loop.dispatch.receipts[0].dispatchId,receipt.dispatchId);
  assert.ok(Number.isFinite(loop.dispatch.receipts[0].approvalLatencyMs));
  assert.deepEqual(loop.publication,{status:'NOT_CONNECTED',postId:null,publishedAt:null});
  assert.deepEqual(loop.performance,{status:'NOT_AVAILABLE'});
  assert.ok(loop.learning.includes('sandbox outbox'));
  assert.ok(loop.learning.includes('No performance data exists'));
});
