import test from 'node:test';
import assert from 'node:assert/strict';
import {missionInput,planMission} from '../lib/mission.js';

const base={name:'Northstar Coffee',industry:'Hospitality / coffee',objective:'Increase morning customer visits'};
const HASH='sha256:'+'ab'.repeat(32);
function evidence(over={}){
  return {sourceUrl:'https://example.org',finalUrl:'https://example.org/',fetchedAt:'2026-10-27T00:00:00.000Z',title:'Northstar Coffee',description:'Single-origin espresso.',excerpt:'Single-origin espresso and fresh pastries.',textChars:120,wordCount:12,contentHash:HASH,citations:['https://example.org'],redirectHops:0,...over};
}

test('validates mission input before any ingestion',()=>{
  assert.throws(()=>missionInput({}),/required/);
  assert.throws(()=>missionInput({...base,website:'http://example.org/'}),/valid HTTPS/);
  assert.throws(()=>missionInput({...base,website:'https://example.org:8443/'}),/valid HTTPS/);
  assert.throws(()=>planMission({}),/required/);
  const f=missionInput({...base,website:'https://example.org'});
  assert.equal(f.website,'https://example.org');
  const alias=missionInput({businessName:'Ali Shoes',industry:'Retail',goal:'Expand sales',websiteUrl:'https://example.org'});
  assert.equal(alias.name,'Ali Shoes');
  assert.equal(alias.objective,'Expand sales');
  assert.equal(alias.website,'https://example.org');
});
test('keeps reference-only behavior without evidence',()=>{
  const m=planMission({...base,website:'https://example.org'});
  assert.equal(m.schemaVersion,'1.1');
  assert.equal(m.evidence.websiteRetrieved,false);
  assert.equal(m.evidence.websiteStatus,'REFERENCE_ONLY_NOT_CRAWLED');
  assert.equal(m.evidence.site,null);
  const none=planMission(base);
  assert.equal(none.evidence.websiteStatus,'NOT_PROVIDED');
});
test('attaches retrieved evidence with redirect status',()=>{
  const m=planMission({...base,website:'https://example.org'},{evidence:evidence({finalUrl:'https://www.example.org/',citations:['https://example.org','https://www.example.org/'],redirectHops:1})});
  assert.equal(m.evidence.websiteRetrieved,true);
  assert.equal(m.evidence.websiteStatus,'RETRIEVED_WITH_REDIRECT');
  assert.equal(m.evidence.site.title,'Northstar Coffee');
  assert.equal(m.evidence.site.contentHash,HASH);
  assert.deepEqual(m.evidence.site.citations,['https://example.org','https://www.example.org/']);
  const direct=planMission({...base,website:'https://example.org'},{evidence:evidence()});
  assert.equal(direct.evidence.websiteStatus,'RETRIEVED');
});
test('records retrieval failure without failing the mission',()=>{
  const m=planMission({...base,website:'https://example.org'},{ingestError:'WEBSITE_HOST_BLOCKED'});
  assert.equal(m.evidence.websiteRetrieved,false);
  assert.equal(m.evidence.websiteStatus,'RETRIEVAL_FAILED_WEBSITE_HOST_BLOCKED');
  assert.equal(m.evidence.site,null);
  const weird=planMission({...base,website:'https://example.org'},{ingestError:'<script>alert(1)</script>'});
  assert.equal(weird.evidence.websiteStatus,'RETRIEVAL_FAILED_UNKNOWN');
});
test('caps and verifies injected evidence fields',()=>{
  const m=planMission({...base,website:'https://example.org'},{evidence:evidence({title:'t'.repeat(500),excerpt:'e'.repeat(5000),contentHash:'bogus',citations:['https://a.example/','https://b.example/'],redirectHops:99})});
  assert.equal(m.evidence.site.title.length,200);
  assert.equal(m.evidence.site.excerpt.length,2000);
  assert.equal(m.evidence.site.contentHash,'UNVERIFIED');
  assert.equal(m.evidence.site.redirectHops,10);
});
