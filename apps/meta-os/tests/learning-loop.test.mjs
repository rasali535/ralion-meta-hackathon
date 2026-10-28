import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningLoop,LEARNING_LOOP_VERSION} from '../lib/learning-loop.js';
import {planMission} from '../lib/mission.js';

function mission(){
  return planMission({name:'Northstar Coffee',industry:'Hospitality',objective:'Increase morning visits',audience:'Local commuters'});
}

test('derives every section from mission content only',()=>{
  const m=mission();
  m.creative.assets.push({assetId:'img_0123456789abcdef',prompt:'Morning cups',mimeType:'image/png',bytes:42,requestedFormat:{id:'square',label:'1:1 Square'}});
  const loop=buildLearningLoop(m);
  assert.equal(loop.schemaVersion,LEARNING_LOOP_VERSION);
  assert.match(loop.loopId,/^loop_[0-9a-f]{12}$/);
  assert.equal(loop.missionId,m.missionId);
  assert.equal(loop.business.name,'Northstar Coffee');
  assert.equal(loop.sourceEvidence.websiteStatus,m.evidence.websiteStatus);
  assert.equal(loop.recommendation.opportunity,m.growth.opportunity);
  assert.equal(loop.recommendation.live,false);
  assert.equal(loop.creative.count,1);
  assert.equal(loop.creative.assets[0].format,'1:1 Square');
  assert.equal(loop.socialDrafts.length,2);
  assert.equal(loop.socialDrafts[0].hasContract,false);
  assert.equal(loop.approval.status,'NOT_REQUESTED');
});

test('loop ids are deterministic for identical bytes',()=>{
  const a=buildLearningLoop(mission());
  const m2=mission();m2.missionId='fixed-id';
  const b1=buildLearningLoop(m2);
  const m3=mission();m3.missionId='fixed-id';
  assert.equal(buildLearningLoop(m3).loopId,b1.loopId);
  m3.approval={status:'APPROVED',planHash:'ph'};
  assert.notEqual(buildLearningLoop(m3).loopId,b1.loopId);
  assert.ok(a.loopId.startsWith('loop_'));
});

test('never reports publishing or performance',()=>{
  const loop=buildLearningLoop(mission());
  assert.deepEqual(loop.publication,{status:'NOT_CONNECTED',postId:null,publishedAt:null});
  assert.deepEqual(loop.performance,{status:'NOT_AVAILABLE'});
  const flat=JSON.stringify(loop).toLowerCase();
  for(const word of ['impressions','conversions','revenue','clicks']){
    assert.ok(!flat.includes('"'+word+'"'),'must not report '+word);
  }
});

test('reflects approval decisions without inventing outcomes',()=>{
  const m=mission();
  m.approval={status:'APPROVED',actor:{id:'Alice',role:'owner'},planHash:'ph123',approvedAt:'2026-10-28T10:00:00.000Z'};
  const loop=buildLearningLoop(m);
  assert.equal(loop.approval.status,'APPROVED');
  assert.equal(loop.approval.actor,'Alice');
  assert.equal(loop.approval.planHash,'ph123');
  assert.ok(loop.learning.includes('No performance data exists'));
  assert.equal(loop.publication.status,'NOT_CONNECTED');
});

test('rejects missing missions and tolerates sparse shapes',()=>{
  assert.throws(()=>buildLearningLoop(null),/MISSION_REQUIRED/);
  assert.throws(()=>buildLearningLoop({}),/MISSION_REQUIRED/);
  const loop=buildLearningLoop({missionId:'m-1'});
  assert.equal(loop.business.name,'');
  assert.equal(loop.creative.count,0);
  assert.deepEqual(loop.socialDrafts,[]);
  assert.equal(loop.sourceEvidence.websiteStatus,'UNKNOWN');
});

test('growth carries a fixed template category label',()=>{
  const m=mission();
  assert.equal(m.growth.category,'MARKETING_ACQUISITION');
});
