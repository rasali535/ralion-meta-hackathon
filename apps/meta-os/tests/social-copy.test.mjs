import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChannelDrafts,hashtagsFor,SOCIAL_COPY_LIMITS} from '../lib/social-copy.js';

const mission={business:{name:'Northstar Coffee',industry:'Hospitality / coffee',objective:'Increase morning customer visits',audience:'Local morning commuters'},growth:{opportunity:'Test a focused campaign for commuters'}};

test('builds distinct channel drafts from mission content',()=>{
  const drafts=buildChannelDrafts(mission);
  assert.equal(drafts.length,2);
  const fb=drafts.find(d=>d.channel==='Facebook');
  const ig=drafts.find(d=>d.channel==='Instagram');
  assert.ok(fb.caption.includes('Northstar Coffee'));
  assert.ok(fb.caption.includes('Increase morning customer visits'));
  assert.ok(ig.caption.includes('Northstar Coffee'));
  assert.notEqual(fb.caption,ig.caption);
  assert.ok(fb.caption.length<=SOCIAL_COPY_LIMITS.facebookCaption);
  assert.ok(ig.caption.length<=SOCIAL_COPY_LIMITS.instagramCaption);
  assert.ok(fb.cta.length>0&&fb.cta.length<=SOCIAL_COPY_LIMITS.cta);
  assert.equal(fb.status,'DRAFT_ONLY');
  assert.equal(ig.status,'DRAFT_ONLY');
});
test('labels grounding and never invents metrics',()=>{
  const [fb,ig]=buildChannelDrafts(mission);
  assert.equal(fb.grounding.source,'MISSION_DRAFT_DERIVED');
  assert.deepEqual(fb.grounding.facts,['business.name','business.objective','business.audience']);
  assert.deepEqual(ig.grounding.facts,['business.name','business.objective','business.audience']);
  const joined=(fb.caption+fb.cta+ig.caption+ig.cta).toLowerCase();
  for(const invented of ['%','roi','conversion','followers','reach','impressions'])assert.ok(!joined.includes(invented),invented);
});
test('derives bounded hashtags for Instagram only',()=>{
  const [fb,ig]=buildChannelDrafts(mission);
  assert.deepEqual(fb.hashtags,[]);
  assert.ok(ig.hashtags.length>0&&ig.hashtags.length<=SOCIAL_COPY_LIMITS.maxHashtags);
  assert.ok(ig.hashtags.every(t=>/^#[a-z0-9]+$/.test(t)));
  assert.deepEqual(hashtagsFor('',''),[]);
});
test('rejects missions without business identity',()=>{
  assert.throws(()=>buildChannelDrafts(null),/SOCIAL_MISSION_REQUIRED/);
  assert.throws(()=>buildChannelDrafts({business:{name:'',objective:'x'}}),/SOCIAL_BUSINESS_REQUIRED/);
  assert.throws(()=>buildChannelDrafts({business:{name:'Shop',objective:''}}),/SOCIAL_BUSINESS_REQUIRED/);
  const twice=[buildChannelDrafts(mission),buildChannelDrafts(mission)];
  assert.deepEqual(twice[0],twice[1]);
});
