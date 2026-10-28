import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {rmSync,mkdirSync} from 'node:fs';
import {mintAssetId,sha256Hex,assetPaths,saveCreativeAsset,loadCreativeAsset,listCreativeAssets} from '../lib/creative-store.js';

const TMP=path.join(import.meta.dirname,'.tmp','store');
function fresh(){rmSync(TMP,{recursive:true,force:true});mkdirSync(TMP,{recursive:true});}
after(()=>rmSync(TMP,{recursive:true,force:true}));
function meta(over={}){
  return {schemaVersion:'1.0',assetId:mintAssetId(),organizationId:'org-1',workspaceId:'ws-1',missionId:null,prompt:'A shop',model:'muse-image-1.0',requestId:'r1',mimeType:'image/png',bytes:8,sha256:'x',createdAt:new Date(1000).toISOString(),delivery:'base64',reviewStatus:'PENDING_REVIEW',briefProvenance:{source:'custom',claimed:false},...over};
}
const PNG=Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);

test('mints well-formed ids and hashes',()=>{
  assert.match(mintAssetId(),/^img_[0-9a-f]{16}$/);
  assert.match(sha256Hex(PNG),/^[0-9a-f]{64}$/);
});
test('round-trips bytes and metadata per tenant',()=>{
  fresh();
  const m=meta();
  const r=saveCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',metadata:m,bytes:PNG});
  assert.equal(r.assetId,m.assetId);
  assert.equal(r.bytes,8);
  const back=loadCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',assetId:m.assetId});
  assert.deepEqual(back.metadata,m);
  assert.ok(back.bytes.equals(PNG));
});
test('rejects path escape and cross-tenant access',()=>{
  fresh();
  const m=meta();
  saveCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',metadata:m,bytes:PNG});
  assert.throws(()=>assetPaths(TMP,'../evil','ws-1',m.assetId),/CREATIVE_ORG_INVALID/);
  assert.throws(()=>assetPaths(TMP,'org-1','ws-1','../../x'),/CREATIVE_ASSET_INVALID/);
  assert.throws(()=>loadCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-2',assetId:m.assetId}),/CREATIVE_ASSET_MISSING/);
  assert.throws(()=>loadCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',assetId:'img_ffffffffffffffff'}),/CREATIVE_ASSET_MISSING/);
  assert.throws(()=>saveCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',metadata:meta({organizationId:'org-2'}),bytes:PNG}),/CREATIVE_TENANT_MISMATCH/);
});
test('lists only the requesting tenant assets in order',()=>{
  fresh();
  const a=meta({createdAt:new Date(2000).toISOString()});
  const b=meta({createdAt:new Date(1000).toISOString()});
  saveCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',metadata:a,bytes:PNG});
  saveCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',metadata:b,bytes:PNG});
  saveCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-2',metadata:meta({organizationId:'org-1',workspaceId:'ws-2'}),bytes:PNG});
  const list=listCreativeAssets(TMP,{organizationId:'org-1',workspaceId:'ws-1'});
  assert.equal(list.length,2);
  assert.equal(list[0].assetId,b.assetId);
  assert.equal(listCreativeAssets(TMP,{organizationId:'org-1',workspaceId:'ws-9'}).length,0);
  assert.throws(()=>listCreativeAssets(TMP,{organizationId:'..',workspaceId:'ws-1'}),/CREATIVE_ORG_INVALID/);
});
test('validates inputs strictly',()=>{
  fresh();
  assert.throws(()=>saveCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',metadata:null,bytes:PNG}),/CREATIVE_METADATA_INVALID/);
  assert.throws(()=>saveCreativeAsset(TMP,{organizationId:'org-1',workspaceId:'ws-1',metadata:meta(),bytes:Buffer.alloc(0)}),/CREATIVE_BYTES_INVALID/);
  assert.throws(()=>saveCreativeAsset('',{organizationId:'o',workspaceId:'w',metadata:meta(),bytes:PNG}),/CREATIVE_STORAGE_INVALID/);
});
