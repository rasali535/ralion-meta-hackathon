import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignPlan } from '../src/core/campaignPlan.js';
test('campaign plan is versioned, channel-specific, and never claims external action',()=>{
 const p=buildCampaignPlan({id:'p1',createdAt:'2026-10-27T00:00:00Z',provider:'DEMO_RULES_NOT_META_AI',business:{name:'Northstar Coffee',objective:'Increase visits',audience:'Commuters'},strategy:{action:'Test an introductory offer',successMetric:'Qualified enquiries'}});
 assert.deepEqual(p.channels.map(x=>x.platform),['facebook','instagram']);
 assert.equal(p.execution,'NOT_PUBLISHED');
 assert.equal(p.campaign.measurementPlan.actualResult,null);
 assert.equal(p.creativeBrief.generatedAsset,null);
 assert.equal(p.provenance.recommendation,'DEMO_RULES_NOT_META_AI');
});
test('rejects incomplete proposal',()=>assert.throws(()=>buildCampaignPlan({}),/Valid proposal/));
