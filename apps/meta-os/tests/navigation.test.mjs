import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKSPACES,WORKSPACE_IDS,WORKFLOW_STEPS,LIVE_ERROR_LABELS,liveErrorLabel,missionStatus,stepState,parseViewParam} from '../lib/navigation.js';

test('declares eight unique workspaces with valid metadata',()=>{
  assert.equal(WORKSPACES.length,8);
  assert.deepEqual([...new Set(WORKSPACES.map(w=>w.id))].sort(),[...WORKSPACE_IDS].sort());
  for(const w of WORKSPACES){
    assert.ok(w.label.length>0);
    assert.ok(w.icon.length>0);
    assert.ok(w.blurb.length>0);
    assert.ok(['live','draft','preview'].includes(w.availability),w.id);
  }
  assert.deepEqual(WORKFLOW_STEPS.map(s=>s.id),['business','mari','growth','creative','social','approval']);
});
test('derives mission presence, mode, and evidence states',()=>{
  assert.deepEqual(missionStatus(null),{presence:'none',mode:'none',live:false,liveError:null,approval:'NONE',hasEvidence:false,hasAi:false});
  const demo={mode:'DETERMINISTIC_DEMO',mariReasoning:null,liveError:null,approval:{status:'NOT_REQUESTED'},evidence:{websiteRetrieved:true}};
  assert.deepEqual(missionStatus(demo),{presence:'active',mode:'demo',live:false,liveError:null,approval:'NOT_REQUESTED',hasEvidence:true,hasAi:false});
  const live={mode:'LIVE_MARI',mariReasoning:{model:'muse-spark-1.3'},liveError:null,approval:{status:'APPROVED'},evidence:{websiteRetrieved:false}};
  const st=missionStatus(live);
  assert.equal(st.mode,'live');
  assert.equal(st.live,true);
  assert.equal(st.hasAi,true);
  assert.equal(st.approval,'APPROVED');
  assert.equal(st.hasEvidence,false);
  const flagged={mode:'LIVE_MARI',mariReasoning:null,liveError:'MARI_QUOTA_EXCEEDED',approval:{},evidence:{}};
  const fs=missionStatus(flagged);
  assert.equal(fs.live,false);
  assert.equal(fs.liveError,'MARI_QUOTA_EXCEEDED');
  assert.equal(fs.approval,'NOT_REQUESTED');
});
test('labels live errors with a safe fallback',()=>{
  assert.equal(liveErrorLabel('MARI_QUOTA_EXCEEDED'),LIVE_ERROR_LABELS.MARI_QUOTA_EXCEEDED);
  assert.equal(liveErrorLabel(null),null);
  assert.ok(liveErrorLabel('SOME_NEW_CODE').includes('SOME_NEW_CODE'));
  assert.ok(liveErrorLabel('x'.repeat(200)).length<=80);
});
test('maps workflow steps from mission state',()=>{
  assert.equal(stepState('business',null),'current');
  assert.equal(stepState('mari',null),'pending');
  assert.equal(stepState('approval',null),'pending');
  const demo={mode:'DETERMINISTIC_DEMO',mariReasoning:null,liveError:null,approval:{status:'NOT_REQUESTED'},evidence:{}};
  for(const id of ['business','mari','growth','social'])assert.equal(stepState(id,demo),'done',id);
  assert.equal(stepState('creative',demo),'limited');
  assert.equal(stepState('approval',demo),'current');
  assert.equal(stepState('approval',{...demo,approval:{status:'APPROVED'}}),'done');
  assert.equal(stepState('approval',{...demo,approval:{status:'REJECTED'}}),'blocked');
  assert.equal(stepState('unknown-step',demo),'pending');
});
test('parses shareable view params strictly',()=>{
  assert.equal(parseViewParam('?view=mari'),'mari');
  assert.equal(parseViewParam('?x=1&view=growth'),'growth');
  assert.equal(parseViewParam('?view=Social'),'social');
  assert.equal(parseViewParam('?view=evil'),null);
  assert.equal(parseViewParam('?view='),null);
  assert.equal(parseViewParam(''),null);
  assert.equal(parseViewParam(null),null);
});
