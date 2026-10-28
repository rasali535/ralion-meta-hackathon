import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {rmSync,mkdirSync} from 'node:fs';
import {planMission,mintMissionApproval} from '../lib/mission.js';
import {saveCreativeAsset,sha256Hex} from '../lib/creative-store.js';
import {verifyApprovalRecord} from '../lib/approval.js';

const TMP=path.join(import.meta.dirname,'.tmp','approve');
function fresh(){rmSync(TMP,{recursive:true,force:true});mkdirSync(TMP,{recursive:true});}
after(()=>rmSync(TMP,{recursive:true,force:true}));
const SECRET='approve-flow-test-secret-32-chars!!';
const base={name:'Northstar Coffee',industry:'Hospitality / coffee',objective:'Increase morning customer visits'};
const PNG=Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
function storedAsset(org='org-1',ws='ws-1'){
  const metadata={schemaVersion:'1.0',assetId:'img_0123456789abcdef',organizationId:org,workspaceId:ws,missionId:null,prompt:'A shop',model:'muse-image-1.0',requestId:'r1',mimeType:'image/png',bytes:PNG.length,sha256:sha256Hex(PNG),createdAt:new Date(1000).toISOString(),delivery:'base64',reviewStatus:'PENDING_REVIEW',briefProvenance:{source:'custom',claimed:false}};
  saveCreativeAsset(TMP,{organizationId:org,workspaceId:ws,metadata,bytes:PNG});
  return metadata;
}
function ctx(over={}){return {actorId:'u-1',role:'owner',organizationId:'org-1',workspaceId:'ws-1',hmacSecret:SECRET,storeRoot:TMP,...over};}
function withAsset(mission,metadata){
  return {...mission,creative:{brief:'b',assets:[{assetId:metadata.assetId,prompt:metadata.prompt,mimeType:metadata.mimeType,bytes:metadata.bytes,sha256:metadata.sha256,reviewStatus:metadata.reviewStatus}],generated:true}};
}

test('mints approvals for asset-free missions without storage',()=>{
  const record=mintMissionApproval(planMission(base),ctx({storeRoot:undefined}));
  assert.equal(record.decision,'APPROVED');
  assert.equal(record.scope,'LOCAL_DRAFT_ONLY');
});
test('mints only when declared assets match stored tenant records',()=>{
  fresh();
  const stored=storedAsset();
  const mission=withAsset(planMission(base),stored);
  const record=mintMissionApproval(mission,ctx());
  assert.equal(verifyApprovalRecord(record,mission,{hmacSecret:SECRET}),true);
});
test('rejects unknown, tampered, and cross-tenant assets',()=>{
  fresh();
  const stored=storedAsset();
  const mission=withAsset(planMission(base),stored);
  const unknown=withAsset(planMission(base),{...stored,assetId:'img_ffffffffffffffff'});
  assert.throws(()=>mintMissionApproval(unknown,ctx()),/APPROVAL_ASSET_UNKNOWN/);
  const tampered=withAsset(planMission(base),{...stored,prompt:'Different prompt'});
  assert.throws(()=>mintMissionApproval(tampered,ctx()),/APPROVAL_ASSET_MISMATCH/);
  fresh();
  storedAsset('org-1','ws-2');
  const crossMission=withAsset(planMission(base),{assetId:'img_0123456789abcdef',prompt:'A shop',mimeType:'image/png',bytes:PNG.length,sha256:sha256Hex(PNG),reviewStatus:'PENDING_REVIEW'});
  assert.throws(()=>mintMissionApproval(crossMission,ctx()),/APPROVAL_ASSET_UNKNOWN/);
});
test('validates mission, tenant, storage, and role',()=>{
  fresh();
  assert.throws(()=>mintMissionApproval(null,ctx()),/APPROVAL_INVALID_MISSION/);
  assert.throws(()=>mintMissionApproval({business:{name:''}},ctx()),/required/);
  assert.throws(()=>mintMissionApproval(planMission(base),ctx({organizationId:''})),/APPROVAL_TENANT_REQUIRED/);
  const stored=storedAsset();
  assert.throws(()=>mintMissionApproval(withAsset(planMission(base),stored),ctx({storeRoot:undefined})),/APPROVAL_STORAGE_REQUIRED/);
  assert.throws(()=>mintMissionApproval(planMission(base),ctx({role:'viewer'})),/APPROVAL_ROLE_UNAUTHORIZED/);
  const rejected=mintMissionApproval(planMission(base),ctx({decision:'REJECTED'}));
  assert.equal(rejected.decision,'REJECTED');
});
