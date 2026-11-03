import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublicationBriefing,BRIEFING_VERSION} from '../lib/publication-briefing.js';
import {planMission} from '../lib/mission.js';

function mission(){
  return planMission({name:'Northstar Coffee',industry:'Hospitality',objective:'Increase morning visits',audience:'Local commuters'});
}
function approved(m){
  m.approval={status:'APPROVED',actor:{id:'Alice',role:'owner'},planHash:'ph123',approvedAt:'2026-10-28T10:00:00.000Z'};
  return m;
}

test('briefs channel rollout from mission content only',()=>{
  const b=buildPublicationBriefing(approved(mission()));
  assert.equal(b.schemaVersion,BRIEFING_VERSION);
  assert.equal(b.status,'READY_FOR_CONNECTOR');
  assert.equal(b.business.name,'Northstar Coffee');
  assert.equal(b.channels.length,2);
  assert.deepEqual(b.channels.map(c=>c.step),[1,2]);
  assert.ok(b.channels[0].channel.length>0);
  assert.ok(b.channels[0].caption.length>0);
  assert.equal(typeof b.channels[0].hasCta,'boolean');
  assert.deepEqual(b.blockedBy,['AUTHORIZED_CONNECTOR']);
  assert.equal(b.published,false);
  assert.ok(b.summary.includes('Northstar Coffee'));
});

test('checklist tracks approval and export honestly',()=>{
  const pending=buildPublicationBriefing(mission());
  assert.equal(pending.status,'AWAITING_APPROVAL');
  assert.deepEqual(pending.blockedBy,['HUMAN_APPROVAL']);
  const byId=Object.fromEntries(pending.checklist.map(c=>[c.id,c.state]));
  assert.equal(byId.DRAFTS,'done');
  assert.equal(byId.APPROVAL,'pending');
  assert.equal(byId.EXPORT,'pending');
  assert.equal(byId.CONNECTOR,'pending');
  const m=approved(mission());
  const ctx={dispatches:[{missionId:m.missionId,dispatchId:'dsp_1',dispatchedAt:'2026-10-28T10:05:00.000Z',approvalLatencyMs:12,bundleHash:'ab'.repeat(32)}]};
  const done=buildPublicationBriefing(m,ctx);
  const byId2=Object.fromEntries(done.checklist.map(c=>[c.id,c.state]));
  assert.equal(byId2.APPROVAL,'done');
  assert.equal(byId2.EXPORT,'done');
  assert.equal(byId2.CONNECTOR,'pending');
  assert.equal(done.dispatchCount,1);
  const rejected=mission();
  rejected.approval={status:'REJECTED'};
  assert.equal(buildPublicationBriefing(rejected).status,'NOT_APPROVED');
});

test('briefing never invents metrics or publishing',()=>{
  const b=buildPublicationBriefing(approved(mission()),{dispatches:[{missionId:'x'}]});
  assert.equal(b.published,false);
  assert.equal(b.metrics,null);
  const flat=JSON.stringify(b).toLowerCase();
  for(const word of ['"likes"','"followers"','"views"','"reach"','"impressions"','"conversions"','"revenue"','"clicks"','"shares"','"comments"']){
    assert.ok(!flat.includes(word),'must not carry '+word);
  }
});

test('rejects missing missions and tolerates sparse shapes',()=>{
  assert.throws(()=>buildPublicationBriefing(null),/MISSION_REQUIRED/);
  assert.throws(()=>buildPublicationBriefing({}),/MISSION_REQUIRED/);
  const b=buildPublicationBriefing({missionId:'m-1'});
  assert.equal(b.status,'AWAITING_APPROVAL');
  assert.deepEqual(b.channels,[]);
  assert.deepEqual(b.blockedBy,['HUMAN_APPROVAL']);
  assert.ok(b.summary.length>0);
});
