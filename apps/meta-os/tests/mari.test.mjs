import test from 'node:test';
import assert from 'node:assert/strict';
import {missionLiveConfig,resolveMariMode,diagnoseWithMari,sanitizeMariErrorCode,MARI_CLAIMS_SOURCE,MARI_MAX_OUTPUT_CHARS} from '../lib/mari.js';

const business={name:'Fictional Shop',industry:'Retail',objective:'Acquire customers'};

test('resolves reasoning modes strictly',()=>{
  assert.equal(resolveMariMode(undefined),'spark');
  assert.equal(resolveMariMode(null),'spark');
  assert.equal(resolveMariMode(''),'spark');
  assert.equal(resolveMariMode('spark'),'spark');
  assert.equal(resolveMariMode('wonder'),'wonder');
  assert.throws(()=>resolveMariMode('turbo'),/MARI_MODE_INVALID/);
  assert.throws(()=>resolveMariMode('WONDER'),/MARI_MODE_INVALID/);
});
test('reads live configuration from flags only',()=>{
  assert.deepEqual(missionLiveConfig({MARI_LIVE_REASONING_ENABLED:'true',META_REASONING_API_ENABLED:'true',MODEL_API_KEY:'k'}),{liveRequested:true,masterEnabled:true,keyConfigured:true});
  assert.deepEqual(missionLiveConfig({}),{liveRequested:false,masterEnabled:false,keyConfigured:false});
  assert.deepEqual(missionLiveConfig({MARI_LIVE_REASONING_ENABLED:'true'}),{liveRequested:true,masterEnabled:false,keyConfigured:false});
});
test('diagnoses through the injected reasoner with labeled output',async()=>{
  const seen=[];
  const reasonImpl=async(args)=>{seen.push(args);return {model:'muse-wonder-1.0',output:'Insight: test mornings.',requestId:'req_1'};};
  const r=await diagnoseWithMari(business,{mode:'wonder',reasonImpl});
  assert.equal(r.source,MARI_CLAIMS_SOURCE);
  assert.equal(r.mode,'wonder');
  assert.equal(r.model,'muse-wonder-1.0');
  assert.equal(r.output,'Insight: test mornings.');
  assert.equal(r.requestId,'req_1');
  assert.deepEqual(seen,[{business,mode:'wonder'}]);
});
test('caps diagnosis output for mission payloads',async()=>{
  const reasonImpl=async()=>({model:'muse-spark-1.3',output:'z'.repeat(9000),requestId:'req_2'});
  const r=await diagnoseWithMari(business,{reasonImpl});
  assert.equal(r.output.length,MARI_MAX_OUTPUT_CHARS);
});
test('rejects empty diagnoses and propagates reasoner failures',async()=>{
  await assert.rejects(()=>diagnoseWithMari(business,{reasonImpl:async()=>({model:'m',output:'',requestId:null})}),/MARI_EMPTY_DIAGNOSIS/);
  await assert.rejects(()=>diagnoseWithMari(business,{reasonImpl:async()=>null}),/MARI_EMPTY_DIAGNOSIS/);
  const boom=new Error('META_MODEL_REQUEST_FAILED_500');
  await assert.rejects(()=>diagnoseWithMari(business,{reasonImpl:async()=>{throw boom;}}),(e)=>e===boom);
});
test('sanitizes diagnosis error codes',()=>{
  for(const code of ['META_MODEL_REQUEST_FAILED_500','META_EMPTY_MODEL_RESPONSE','BUSINESS_CONTEXT_REQUIRED','UNSUPPORTED_REASONING_MODEL','MARI_MODE_INVALID','BUDGET_EXCEEDED'])assert.equal(sanitizeMariErrorCode(new Error(code)),code);
  for(const e of [new Error('socket hangup'),new Error('META_X;evil'),new Error(''),null,undefined,{}])assert.equal(sanitizeMariErrorCode(e),'MARI_DIAGNOSIS_FAILED');
});
