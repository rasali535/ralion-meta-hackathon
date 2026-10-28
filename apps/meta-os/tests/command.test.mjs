import test from 'node:test';
import assert from 'node:assert/strict';
import {missingBusinessFields,telemetrySummary,kpiFromMission,workflowProgress,activityEvents,quickActions,guidanceFor} from '../lib/command.js';
import {planMission} from '../lib/mission.js';

function mission(){
  return planMission({name:'Northstar Coffee',industry:'Hospitality',objective:'Increase morning visits',audience:'Local commuters'});
}
const RECORDS=[
  {model:'muse-spark-1.3',operation:'reason',ok:true,requestId:'req_1',timestamp:'2026-10-28T10:00:00.000Z',budget:{outcome:'confirmed',remainingUnits:99}},
  {model:'muse-image-1.0',operation:'image-generation',ok:false,requestId:null,timestamp:'2026-10-28T10:01:00.000Z',budget:{outcome:'released',remainingUnits:10}},
];

test('detects missing business fields for hero redirects',()=>{
  assert.deepEqual(missingBusinessFields({name:'n',industry:'i',objective:'o'}),[]);
  assert.deepEqual(missingBusinessFields({name:'n'}),['industry','objective']);
  assert.deepEqual(missingBusinessFields(null),['name','industry','objective']);
  assert.deepEqual(missingBusinessFields({name:' ',industry:'i',objective:'o'}),['name']);
});

test('summarizes telemetry without inventing values',()=>{
  const s=telemetrySummary(RECORDS);
  assert.equal(s.total,2);
  assert.equal(s.byModel['muse-spark-1.3'].calls,1);
  assert.equal(s.byModel['muse-image-1.0'].failures,1);
  assert.equal(s.byModel['muse-spark-1.3'].remainingUnits,99);
  assert.deepEqual(telemetrySummary(null),{total:0,byModel:{}});
  assert.deepEqual(telemetrySummary([]),{total:0,byModel:{}});
});

test('kpis report honest zero and unavailable states',()=>{
  const empty=kpiFromMission(null,null);
  assert.equal(empty[0].value,'0');
  assert.equal(empty[1].value,'0');
  assert.equal(empty[2].value,'0');
  assert.equal(empty[3].value,'Unavailable');
  const m=mission();
  const kpis=kpiFromMission(m,[]);
  assert.equal(kpis[0].value,'1');
  assert.equal(kpis[1].value,'0');
  assert.equal(kpis[2].value,'1');
  assert.equal(kpis[2].sub,'Awaiting human review');
  assert.equal(kpis[3].value,'No calls');
  const withUsage=kpiFromMission(m,RECORDS);
  assert.equal(withUsage[3].value,'2');
  m.approval={status:'APPROVED'};
  assert.equal(kpiFromMission(m,[])[2].value,'0');
});

test('workflow tracker covers all seven states honestly',()=>{
  const none=workflowProgress(null);
  assert.ok(none.every(s=>s.state==='not-started'));
  assert.equal(none[0].detail,'Start here');
  const m=mission();
  const states=Object.fromEntries(workflowProgress(m).map(s=>[s.id,s.state]));
  assert.deepEqual(states,{business:'ready',mari:'ready',growth:'ready',creative:'not-started',social:'draft-generated',approval:'awaiting-approval'});
  m.mode='LIVE_MARI';m.mariReasoning={model:'muse-spark-1.3'};
  assert.equal(workflowProgress(m).find(s=>s.id==='mari').state,'in-progress');
  m.creative.assets.push({assetId:'img_1'});
  assert.equal(workflowProgress(m).find(s=>s.id==='creative').state,'draft-generated');
  m.approval={status:'APPROVED'};
  const approved=workflowProgress(m).find(s=>s.id==='approval');
  assert.equal(approved.state,'locally-approved');
  assert.ok(approved.detail.includes('publishing disconnected'));
  m.approval={status:'REJECTED'};
  assert.equal(workflowProgress(m).find(s=>s.id==='approval').state,'failed');
  assert.ok(workflowProgress(m).every(s=>s.view));
});

test('activity events carry type, time, view, and model attribution',()=>{
  assert.deepEqual(activityEvents(null,[]),[]);
  const events=activityEvents(mission(),RECORDS);
  assert.ok(events.some(e=>e.type==='mission'&&e.view==='mari'));
  assert.ok(events.some(e=>e.type==='evidence'&&e.view==='business'));
  const model=events.filter(e=>e.type==='model');
  assert.equal(model.length,2);
  assert.equal(model[0].model,'muse-spark-1.3');
  assert.ok(model[1].label.includes('failed'));
  const m=mission();
  m.creative.assets.push({assetId:'img_0123456789abcdef',mimeType:'image/png',createdAt:'2026-10-28T10:02:00.000Z'});
  m.approval={status:'APPROVED',actor:{id:'Alice'},approvedAt:'2026-10-28T10:03:00.000Z'};
  const full=activityEvents(m,[]);
  assert.ok(full.some(e=>e.type==='creative'));
  assert.ok(full.some(e=>e.type==='approval'&&e.detail.includes('Alice')));
});

test('failure guidance maps codes to recovery steps',()=>{
  assert.ok(guidanceFor('BUDGET_EXCEEDED').includes('daily reset'));
  assert.ok(guidanceFor('MARI_UNAUTHORIZED').includes('demo session'));
  assert.ok(guidanceFor('META_MODEL_REQUEST_FAILED_500').includes('released'));
  assert.ok(guidanceFor('CREATIVE_CONFIRM_REQUIRED').includes('confirmation'));
  assert.ok(guidanceFor('WEBSITE_FETCH_FAILED').includes('safely'));
  assert.ok(guidanceFor('SOMETHING_NEW').includes('Retry'));
  assert.equal(guidanceFor(null),'No error recorded.');
});

test('quick actions gate on real prerequisites',()=>{
  const none=quickActions(null);
  assert.equal(none.filter(a=>a.enabled).length,2);
  assert.ok(none.find(a=>a.id==='growth').hint.includes('Needs a mission'));
  const m=mission();
  const actions=quickActions(m);
  assert.ok(actions.find(a=>a.id==='approval').enabled);
  m.approval={status:'APPROVED'};
  assert.equal(quickActions(m).find(a=>a.id==='approval').enabled,false);
  assert.ok(actions.every(a=>a.view&&a.hint));
});
