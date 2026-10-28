import test from 'node:test';
import assert from 'node:assert/strict';
import {createTelemetryBuffer,recordModelUsage,modelTelemetry,TELEMETRY_OPERATIONS} from '../lib/telemetry.js';

function entry(over={}){
  return {model:'muse-spark-1.3',provider:'META_MODEL_API',requestId:'req_1',organizationId:'org-1',workspaceId:'ws-1',operation:'reason',ok:true,latencyMs:120,usage:{inputTokens:10,outputTokens:20},budget:{outcome:'confirmed',remainingUnits:99},...over};
}

test('records a structured usage entry with verified fields only',()=>{
  const buf=createTelemetryBuffer();
  const rec=buf.record(entry());
  assert.equal(rec.schemaVersion,'1.0');
  assert.match(rec.id,/^tmu_[0-9a-f]{16}$/);
  assert.equal(rec.model,'muse-spark-1.3');
  assert.equal(rec.provider,'META_MODEL_API');
  assert.equal(rec.requestId,'req_1');
  assert.equal(rec.operation,'reason');
  assert.equal(rec.ok,true);
  assert.equal(rec.latencyMs,120);
  assert.deepEqual(rec.usage,{inputTokens:10,outputTokens:20});
  assert.deepEqual(rec.budget,{outcome:'confirmed',remainingUnits:99});
  assert.deepEqual(Object.keys(rec).sort(),['budget','errorCode','id','latencyMs','model','ok','operation','organizationId','provider','requestId','schemaVersion','timestamp','usage','workspaceId']);
});

test('unknown values stay null instead of fabricated',()=>{
  const buf=createTelemetryBuffer();
  const rec=buf.record(entry({requestId:null,latencyMs:null,usage:null,budget:null,errorCode:null}));
  assert.equal(rec.requestId,null);
  assert.equal(rec.latencyMs,null);
  assert.equal(rec.usage,null);
  assert.equal(rec.budget,null);
  assert.equal(rec.errorCode,null);
});

test('rejects malformed usage, budget, and operations',()=>{
  const buf=createTelemetryBuffer();
  assert.equal(buf.record(entry({usage:{inputTokens:'lots'}})).usage,null);
  assert.equal(buf.record(entry({usage:{inputTokens:-1}})).usage,null);
  assert.equal(buf.record(entry({budget:{outcome:'maybe'}})).budget,null);
  assert.equal(buf.record(entry({latencyMs:'fast'})).latencyMs,null);
  assert.throws(()=>buf.record(entry({operation:'publish'})),/OPERATION_INVALID/);
  assert.throws(()=>buf.record(entry({ok:'yes'})),/OUTCOME_REQUIRED/);
  assert.throws(()=>buf.record(entry({model:''})),/MODEL_REQUIRED/);
  assert.throws(()=>buf.record(entry({organizationId:'../x'})),/TENANT_REQUIRED/);
  assert.deepEqual([...TELEMETRY_OPERATIONS],['reason','mari-diagnosis','image-generation']);
});

test('drops unrecognized fields and caps lengths',()=>{
  const buf=createTelemetryBuffer();
  const rec=buf.record(entry({prompt:'secret business plan',apiKey:'k',model:'m'.repeat(200),requestId:'r'.repeat(500)}));
  assert.ok(!('prompt' in rec));
  assert.ok(!('apiKey' in rec));
  assert.equal(rec.model.length,80);
  assert.equal(rec.requestId.length,120);
});

test('lists newest-first per tenant with clamped limits',()=>{
  const buf=createTelemetryBuffer();
  buf.record(entry({requestId:'a',now:1000}));
  buf.record(entry({requestId:'b',now:2000}));
  buf.record(entry({requestId:'c',workspaceId:'ws-2',now:3000}));
  const list=buf.list({organizationId:'org-1',workspaceId:'ws-1'});
  assert.deepEqual(list.map(r=>r.requestId),['b','a']);
  assert.equal(buf.list({organizationId:'org-1',workspaceId:'ws-1',limit:1}).length,1);
  assert.equal(buf.list({organizationId:'org-1',workspaceId:'ws-2'}).length,1);
  assert.throws(()=>buf.list({organizationId:'org-1'}),/TENANT_REQUIRED/);
});

test('bounds memory and resets cleanly',()=>{
  const buf=createTelemetryBuffer({capacity:3});
  for(let i=0;i<5;i++)buf.record(entry({requestId:'r'+i}));
  assert.equal(buf.size(),3);
  assert.deepEqual(buf.list({organizationId:'org-1',workspaceId:'ws-1'}).map(r=>r.requestId),['r4','r3','r2']);
  buf.reset();
  assert.equal(buf.size(),0);
});

test('shared helper records into the global buffer',()=>{
  modelTelemetry.reset();
  const rec=recordModelUsage(entry({requestId:'shared-1'}));
  assert.equal(rec.requestId,'shared-1');
  assert.equal(modelTelemetry.list({organizationId:'org-1',workspaceId:'ws-1'}).length,1);
  modelTelemetry.reset();
});
