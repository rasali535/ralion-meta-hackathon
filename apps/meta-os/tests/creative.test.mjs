import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {rmSync,mkdirSync} from 'node:fs';
import {generateCreativeAsset,sniffImageType,creativeConfig,CREATIVE_MAX_BYTES,CREATIVE_ALLOWED_TYPES} from '../lib/creative.js';
import {loadCreativeAsset} from '../lib/creative-store.js';

const TMP=path.join(import.meta.dirname,'.tmp','creative');
function fresh(){rmSync(TMP,{recursive:true,force:true});mkdirSync(TMP,{recursive:true});}
after(()=>rmSync(TMP,{recursive:true,force:true}));
const tenant={organizationId:'org-1',workspaceId:'ws-1'};
const PNG=Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00]);
const B64=PNG.toString('base64');
function base(over={}){
  return {tenant,brief:{source:'growth',text:'Morning cups',businessName:'Northstar Coffee',businessIndustry:'Hospitality'},confirm:true,missionId:'m-1',storeRoot:TMP,now:1000,...over};
}

test('sniffs image types from magic bytes',()=>{
  assert.equal(sniffImageType(PNG),'image/png');
  assert.equal(sniffImageType(Buffer.from([0xFF,0xD8,0xFF,0xE0])),'image/jpeg');
  assert.equal(sniffImageType(Buffer.from('GIF89a0','ascii')),'image/gif');
  assert.equal(sniffImageType(Buffer.concat([Buffer.from('RIFF','ascii'),Buffer.alloc(4),Buffer.from('WEBP','ascii')])),'image/webp');
  assert.equal(sniffImageType(Buffer.from('not-an-image')),'image/png'.slice(0,0)||null);
  assert.deepEqual([...CREATIVE_ALLOWED_TYPES].sort(),['image/gif','image/jpeg','image/png','image/webp']);
  assert.ok(CREATIVE_MAX_BYTES>=1024*1024);
});
test('reads creative feature gates from env only',()=>{
  assert.deepEqual(creativeConfig({CREATIVE_GENERATION_ENABLED:'true',META_REASONING_API_ENABLED:'true',MODEL_API_KEY:'k'}),{enabled:true,masterEnabled:true,keyConfigured:true,storageDir:'.data/creative'});
  assert.deepEqual(creativeConfig({CREATIVE_STORAGE_DIR:'/tmp/x'}),{enabled:false,masterEnabled:false,keyConfigured:false,storageDir:'/tmp/x'});
});
test('generates from base64 delivery and stores bytes plus metadata',async()=>{
  fresh();
  const seen=[];
  const generateImpl=async(args)=>{seen.push(args);return {model:'muse-image-1.0',imageBase64:B64,imageUrl:null,requestId:'req_img_1'};};
  const {metadata}=await generateCreativeAsset(base({generateImpl}));
  assert.ok(seen[0].prompt.includes('Northstar Coffee'));
  assert.equal(metadata.organizationId,'org-1');
  assert.equal(metadata.workspaceId,'ws-1');
  assert.equal(metadata.missionId,'m-1');
  assert.equal(metadata.mimeType,'image/png');
  assert.equal(metadata.bytes,PNG.length);
  assert.match(metadata.sha256,/^[0-9a-f]{64}$/);
  assert.equal(metadata.delivery,'base64');
  assert.equal(metadata.reviewStatus,'PENDING_REVIEW');
  assert.deepEqual(metadata.briefProvenance,{source:'growth',claimed:true});
  const back=loadCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',assetId:metadata.assetId});
  assert.ok(back.bytes.equals(PNG));
});
test('prefers user-edited prompts over built ones',async()=>{
  fresh();
  const generateImpl=async()=>({model:'m',imageBase64:B64,imageUrl:null,requestId:null});
  const {metadata}=await generateCreativeAsset(base({generateImpl,prompt:'Custom storefront photo'}));
  assert.equal(metadata.prompt,'Custom storefront photo');
});
test('retrieves signed-url delivery through injected media fetch',async()=>{
  fresh();
  const fetched=[];
  const generateImpl=async()=>({model:'m',imageBase64:null,imageUrl:'https://cdn.example/x.png',requestId:'r2'});
  const fetchMediaImpl=async(url)=>{fetched.push(url);return {bytes:PNG,contentType:'image/png'};};
  const {metadata}=await generateCreativeAsset(base({generateImpl,fetchMediaImpl}));
  assert.deepEqual(fetched,['https://cdn.example/x.png']);
  assert.equal(metadata.delivery,'url');
  await assert.rejects(()=>generateCreativeAsset(base({generateImpl})),/CREATIVE_FETCH_UNAVAILABLE/);
});
test('enforces confirmation, tenant, brief, and media limits',async()=>{
  fresh();
  const generateImpl=async()=>({model:'m',imageBase64:B64,imageUrl:null,requestId:null});
  await assert.rejects(()=>generateCreativeAsset(base({generateImpl,confirm:false})),/CREATIVE_CONFIRM_REQUIRED/);
  await assert.rejects(()=>generateCreativeAsset(base({generateImpl,tenant:{organizationId:'',workspaceId:'ws-1'}})),/CREATIVE_TENANT_REQUIRED/);
  await assert.rejects(()=>generateCreativeAsset(base({generateImpl,brief:{source:'ads',text:'x',businessName:'S'}})),/CREATIVE_BRIEF_INVALID/);
  const huge=Buffer.alloc(CREATIVE_MAX_BYTES+1);
  await assert.rejects(()=>generateCreativeAsset(base({generateImpl:async()=>({model:'m',imageBase64:huge.toString('base64'),imageUrl:null,requestId:null})})),/CREATIVE_MEDIA_TOO_LARGE/);
  await assert.rejects(()=>generateCreativeAsset(base({generateImpl:async()=>({model:'m',imageBase64:Buffer.from('plain-text').toString('base64'),imageUrl:null,requestId:null})})),/CREATIVE_MEDIA_TYPE_REJECTED/);
  await assert.rejects(()=>generateCreativeAsset(base({generateImpl:async()=>({model:'m',imageBase64:null,imageUrl:null,requestId:null})})),/CREATIVE_EMPTY_RESULT/);
  const boom=new Error('META_MODEL_REQUEST_FAILED_500');
  await assert.rejects(()=>generateCreativeAsset(base({generateImpl:async()=>{throw boom;}})),(e)=>e===boom);
});
