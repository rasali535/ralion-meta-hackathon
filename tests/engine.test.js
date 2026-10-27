import test from 'node:test'; import assert from 'node:assert/strict';
import {validateBusiness, makeEvidence, createProposal, demoStrategy, approve, executeDraft} from '../src/engine.js';
const business={name:'Northstar Coffee',industry:'Coffee shop',objective:'Increase leads',audience:'Commuters'};
test('requires business identity',()=>assert.throws(()=>validateBusiness({}),/required/));
test('accepts metric evidence without fabricating data',()=>{const e=makeEvidence(business,{visits:100,leads:4});assert.equal(e.metrics.conversionRatePercent,4);assert.equal(makeEvidence(business,{}).metrics,null)});
test('requires approval, never publishes or spends',()=>{const evidence=makeEvidence(business,{visits:100,leads:4});const p=createProposal(evidence,demoStrategy(evidence),'DEMO_RULES_NOT_META_AI');assert.throws(()=>executeDraft(p),/Approval required/);approve(p,'Owner');executeDraft(p);assert.equal(p.actionReceipt.mode,'LOCAL_DRAFT_ONLY');assert.equal(p.actionReceipt.actualPerformance,null);assert.throws(()=>executeDraft(p),/Approval required/);});
test('rejects invalid proposals',()=>assert.throws(()=>createProposal(makeEvidence(business,{}),{insight:'x'},'demo'),/Invalid strategy/));
