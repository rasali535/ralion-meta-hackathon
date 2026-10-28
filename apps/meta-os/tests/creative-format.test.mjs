import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {rmSync,mkdirSync} from 'node:fs';
import {CREATIVE_FORMATS,DEFAULT_CREATIVE_FORMAT,resolveCreativeFormat,formatPromptPhrase,formatAspect} from '../lib/creative-format.js';
import {buildImagePrompt} from '../lib/image-prompt.js';
import {generateCreativeAsset} from '../lib/creative.js';

const TMP=path.join(import.meta.dirname,'.tmp','creative-format');
function fresh(){rmSync(TMP,{recursive:true,force:true});mkdirSync(TMP,{recursive:true});}
after(()=>rmSync(TMP,{recursive:true,force:true}));
const PNG=Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00]);
const B64=PNG.toString('base64');
const tenant={organizationId:'org-1',workspaceId:'ws-1'};
const brief={source:'growth',text:'Morning cups',businessName:'Northstar Coffee',businessIndustry:'Hospitality'};

test('format table carries the three requested sizes',()=>{
  assert.equal(DEFAULT_CREATIVE_FORMAT,'square');
  assert.deepEqual(CREATIVE_FORMATS.map(f=>[f.id,f.width,f.height]),[['square',1080,1080],['portrait',1080,1350],['story',1080,1920]]);
  assert.ok(Object.isFrozen(CREATIVE_FORMATS));
});

test('resolves ids case-insensitively and defaults safely',()=>{
  assert.equal(resolveCreativeFormat('portrait').label,'4:5 Portrait');
  assert.equal(resolveCreativeFormat(' STORY ').id,'story');
  assert.equal(resolveCreativeFormat(undefined).id,'square');
  assert.equal(resolveCreativeFormat(null).id,'square');
  assert.equal(resolveCreativeFormat('').id,'square');
  assert.throws(()=>resolveCreativeFormat('16:9'),/CREATIVE_FORMAT_INVALID/);
  assert.throws(()=>resolveCreativeFormat('square;rm'),/CREATIVE_FORMAT_INVALID/);
});

test('builds framing phrases and aspect labels',()=>{
  assert.equal(formatPromptPhrase('square'),'Compose for a 1:1 Square frame (1080 by 1080)');
  assert.ok(formatPromptPhrase('portrait').includes('1080 by 1350'));
  assert.equal(formatAspect('story'),'1080 / 1920');
  assert.throws(()=>formatPromptPhrase('wide'),/CREATIVE_FORMAT_INVALID/);
});

test('built prompts include framing while edited prompts stay verbatim',()=>{
  const built=buildImagePrompt({businessName:'Northstar Coffee',businessIndustry:'Hospitality',brief:'Morning cups',format:'portrait'});
  assert.ok(built.includes('4:5 Portrait'));
  const plain=buildImagePrompt({businessName:'Northstar Coffee',brief:'Morning cups'});
  assert.ok(!plain.includes('Compose for a'));
  assert.throws(()=>buildImagePrompt({businessName:'n',brief:'b',format:'wide'}),/CREATIVE_FORMAT_INVALID/);
});

test('generation records the requested format and frames built prompts',async()=>{
  fresh();
  const seen=[];
  const generateImpl=async(args)=>{seen.push(args);return {model:'muse-image-1.0',imageBase64:B64,imageUrl:null,requestId:'req_1'};};
  const {metadata}=await generateCreativeAsset({tenant,brief,confirm:true,missionId:'m-1',format:'story',generateImpl,storeRoot:TMP,now:1000});
  assert.deepEqual(metadata.requestedFormat,{id:'story',label:'9:16 Story',width:1080,height:1920});
  assert.ok(seen[0].prompt.includes('9:16 Story'));
});

test('generation defaults to square and keeps edited prompts verbatim',async()=>{
  fresh();
  const generateImpl=async()=>({model:'m',imageBase64:B64,imageUrl:null,requestId:null});
  const {metadata}=await generateCreativeAsset({tenant,brief,prompt:'Custom storefront photo',confirm:true,missionId:'m-1',generateImpl,storeRoot:TMP,now:1000});
  assert.equal(metadata.prompt,'Custom storefront photo');
  assert.equal(metadata.requestedFormat.id,'square');
});

test('invalid formats fail before any billable call',async()=>{
  fresh();
  let calls=0;
  const generateImpl=async()=>{calls++;return {model:'m',imageBase64:B64,imageUrl:null,requestId:null};};
  await assert.rejects(()=>generateCreativeAsset({tenant,brief,confirm:true,missionId:'m-1',format:'imax',generateImpl,storeRoot:TMP}),/CREATIVE_FORMAT_INVALID/);
  assert.equal(calls,0);
});
