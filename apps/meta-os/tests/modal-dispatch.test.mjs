import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planMission,mintMissionApproval} from '../lib/mission.js';
import {buildDispatchReceipt,verifyDispatchReceipt,attachDispatchExecution,dispatchBundlePayload} from '../lib/dispatch.js';
import {modalDispatchConfig,modalAuthConfig,executeInModalSandbox,sanitizeModalErrorCode,MODAL_EXECUTOR} from '../lib/modal-dispatch.js';

const SECRET='modal-flow-test-secret-32-chars!!!';
const base={name:'Northstar Coffee',industry:'Hospitality / coffee',objective:'Increase morning customer visits'};
const tenant={organizationId:'org-1',workspaceId:'ws-1'};
const ENDPOINT='https://modal-labs--ralion-dispatch-executor-execute.modal.run';
function approved(){
  const mission=planMission(base);
  const approval=mintMissionApproval(mission,{actorId:'alice',role:'marketing_lead',organizationId:'org-1',workspaceId:'ws-1',hmacSecret:SECRET});
  return {mission,approval};
}
function okFetch(captured,body={ok:true,executionId:'mexec_0123456789abcdef',bundleHashVerified:true,checks:{assetCount:0,channelCount:2},packagedAt:'2026-11-02T12:00:00.000Z'}){
  return async (url,opts)=>{captured.push({url,body:JSON.parse(opts.body)});return {ok:true,status:200,json:async()=>body};};
}

test('posts the bundle payload and returns the sandbox attestation',async ()=>{
  const {mission,approval}=approved();
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET});
  const captured=[];
  const att=await executeInModalSandbox({...dispatchBundlePayload(receipt),MODAL_TOKEN_ID:'ak-secret',MODAL_TOKEN_SECRET:'as-secret'},{endpointUrl:ENDPOINT,fetchImpl:okFetch(captured)});
  assert.equal(captured.length,1);
  assert.equal(captured[0].url,ENDPOINT);
  assert.deepEqual(Object.keys(captured[0].body).sort(),['bundleJson','claimedBundleHash']);
  assert.equal(captured[0].body.claimedBundleHash,receipt.bundleHash);
  assert.equal(captured[0].body.bundleJson,receipt.bundleJson);
  assert.equal(att.executionId,'mexec_0123456789abcdef');
  assert.equal(att.executor,MODAL_EXECUTOR);
  assert.equal(att.bundleHashVerified,true);
  assert.deepEqual(modalDispatchConfig({MODAL_DISPATCH_URL:ENDPOINT}),{enabled:true,endpointUrl:ENDPOINT});
  assert.deepEqual(modalDispatchConfig({MODAL_DISPATCH_URL:ENDPOINT,MODAL_SANDBOX_ENABLED:'false'}),{enabled:false,endpointUrl:ENDPOINT});
  assert.deepEqual(modalDispatchConfig({}),{enabled:false,endpointUrl:''});
  assert.deepEqual(modalDispatchConfig({MODAL_DISPATCH_URL:'http://insecure'}),{enabled:false,endpointUrl:'http://insecure'});
  const authCfg=modalAuthConfig({MODAL_TOKEN_ID:'ak-123',MODAL_TOKEN_SECRET:'as-456',MODAL_SANDBOX_ENABLED:'false',MODAL_DISPATCH_URL:ENDPOINT});
  assert.deepEqual(authCfg,{sandboxEnabled:false,enabled:false,authConfigured:true,tokenIdPresent:true,tokenSecretPresent:true,endpointConfigured:true});
  assert.equal(JSON.stringify(authCfg).includes('ak-123'),false);
  assert.equal(JSON.stringify(authCfg).includes('as-456'),false);
});

test('rejects unconfigured endpoints and invalid bundles without network',async ()=>{
  let calls=0;
  const spy=async()=>{calls++;return {ok:true,status:200,json:async()=>({ok:true,executionId:'mexec_x'})};};
  await assert.rejects(()=>executeInModalSandbox({bundleJson:'{}'},{endpointUrl:'',fetchImpl:spy}),/MODAL_ENDPOINT_NOT_CONFIGURED/);
  await assert.rejects(()=>executeInModalSandbox({bundleJson:'{}'},{endpointUrl:'http://plain',fetchImpl:spy}),/MODAL_ENDPOINT_NOT_CONFIGURED/);
  await assert.rejects(()=>executeInModalSandbox(null,{endpointUrl:ENDPOINT,fetchImpl:spy}),/MODAL_BUNDLE_INVALID/);
  await assert.rejects(()=>executeInModalSandbox({bundleJson:''},{endpointUrl:ENDPOINT,fetchImpl:spy}),/MODAL_BUNDLE_INVALID/);
  assert.equal(calls,0);
});

test('maps sandbox failures to MODAL_ codes',async ()=>{
  const payload={bundleJson:'{"a":1}'};
  const err=async ()=>{throw new Error('socket hangup');};
  await assert.rejects(()=>executeInModalSandbox(payload,{endpointUrl:ENDPOINT,fetchImpl:err}),/MODAL_REQUEST_FAILED/);
  const abort=async ()=>{throw Object.assign(new Error('aborted'),{name:'AbortError'});};
  await assert.rejects(()=>executeInModalSandbox(payload,{endpointUrl:ENDPOINT,fetchImpl:abort}),/MODAL_REQUEST_TIMEOUT/);
  const bad=async ()=>({ok:false,status:503,json:async()=>({})});
  await assert.rejects(()=>executeInModalSandbox(payload,{endpointUrl:ENDPOINT,fetchImpl:bad}),/MODAL_SANDBOX_ERROR_503/);
  const rejected=async ()=>({ok:true,status:200,json:async()=>({ok:false,error:'BUNDLE_INVALID'})});
  await assert.rejects(()=>executeInModalSandbox(payload,{endpointUrl:ENDPOINT,fetchImpl:rejected}),/MODAL_SANDBOX_REJECTED/);
  const missing=async ()=>({ok:true,status:200,json:async()=>({ok:true})});
  await assert.rejects(()=>executeInModalSandbox(payload,{endpointUrl:ENDPOINT,fetchImpl:missing}),/MODAL_EXECUTION_INVALID/);
  assert.equal(sanitizeModalErrorCode(new Error('MODAL_REQUEST_TIMEOUT')),'MODAL_REQUEST_TIMEOUT');
  assert.equal(sanitizeModalErrorCode(new Error('https://secret-endpoint.modal.run leaked')),'MODAL_SANDBOX_FAILED');
});

test('attachDispatchExecution binds the id and keeps verifying',()=>{
  const {mission,approval}=approved();
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET});
  const bound=attachDispatchExecution(receipt,{executionId:'mexec_0123456789abcdef',executor:'modal-sandbox',bundleHashVerified:true,packagedAt:'2026-11-02T12:00:00.000Z'},{hmacSecret:SECRET});
  assert.equal(bound.sandboxExecution.executionId,'mexec_0123456789abcdef');
  assert.equal(bound.bundleHash,receipt.bundleHash);
  assert.notEqual(bound.signature,receipt.signature);
  assert.equal(verifyDispatchReceipt(bound,{hmacSecret:SECRET}),true);
  assert.equal(verifyDispatchReceipt(receipt,{hmacSecret:SECRET}),true);
});

test('tampering the bound execution id breaks verification',()=>{
  const {mission,approval}=approved();
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET});
  const bound=attachDispatchExecution(receipt,{executionId:'mexec_0123456789abcdef'},{hmacSecret:SECRET});
  const swapped={...bound,sandboxExecution:{...bound.sandboxExecution,executionId:'mexec_ffffffffffffffff'}};
  assert.equal(verifyDispatchReceipt(swapped,{hmacSecret:SECRET}),false);
  const stripped={...bound,sandboxExecution:null};
  assert.equal(verifyDispatchReceipt(stripped,{hmacSecret:SECRET}),false);
});

test('attach validates inputs and refuses unsigned receipts',()=>{
  const {mission,approval}=approved();
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET});
  assert.throws(()=>attachDispatchExecution(null,{executionId:'mexec_x'},{hmacSecret:SECRET}),/DISPATCH_RECEIPT_INVALID/);
  assert.throws(()=>attachDispatchExecution(receipt,null,{hmacSecret:SECRET}),/DISPATCH_EXECUTION_INVALID/);
  assert.throws(()=>attachDispatchExecution(receipt,{},{hmacSecret:SECRET}),/DISPATCH_EXECUTION_INVALID/);
  assert.throws(()=>attachDispatchExecution(receipt,{executionId:'mexec_x'},{}),/DISPATCH_SECRET_REQUIRED/);
  const forged={...receipt,signature:'0'.repeat(64)};
  assert.throws(()=>attachDispatchExecution(forged,{executionId:'mexec_x'},{hmacSecret:SECRET}),/DISPATCH_RECEIPT_INVALID/);
});

test('bundle payload carries the exact hashed string; verify never trusts it',()=>{
  const {mission,approval}=approved();
  const receipt=buildDispatchReceipt({mission,approval,tenant,hmacSecret:SECRET});
  const payload=dispatchBundlePayload(receipt);
  assert.equal(createHash('sha256').update(payload.bundleJson,'utf8').digest('hex'),receipt.bundleHash);
  const relabeled={...receipt,bundleJson:'{"forged":true}'};
  assert.equal(verifyDispatchReceipt(relabeled,{hmacSecret:SECRET}),true);
  assert.throws(()=>dispatchBundlePayload(null),/DISPATCH_RECEIPT_INVALID/);
  assert.throws(()=>dispatchBundlePayload({...receipt,bundleJson:''}),/DISPATCH_BUNDLE_INVALID/);
});
