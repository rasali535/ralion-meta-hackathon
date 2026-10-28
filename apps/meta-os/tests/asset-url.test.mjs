import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {signAssetUrl,verifyAssetUrl,ASSET_URL_TTL_MS,ASSET_URL_MAX_TTL_MS} from '../lib/asset-url.js';

const SECRET='asset-url-test-secret-32-chars-min!';
const NOW=1761600000000;
const ID='img_0123456789abcdef';
function sign(over={}){return signAssetUrl({organizationId:'org-1',workspaceId:'ws-1',assetId:ID,hmacSecret:SECRET,now:NOW,...over});}

test('signs and verifies single-asset capabilities',()=>{
  const s=sign();
  assert.equal(s.exp,String(NOW+ASSET_URL_TTL_MS));
  assert.match(s.sig,/^[0-9a-f]{64}$/);
  assert.ok(s.url.startsWith('/api/creative/asset?'));
  assert.ok(s.url.includes('id='+ID));
  const v=verifyAssetUrl({id:ID,org:'org-1',ws:'ws-1',exp:s.exp,sig:s.sig,hmacSecret:SECRET,now:NOW});
  assert.deepEqual(v,{organizationId:'org-1',workspaceId:'ws-1',assetId:ID});
});
test('rejects tampered, cross-tenant, and wrong-secret urls',()=>{
  const s=sign();
  const base={id:ID,org:'org-1',ws:'ws-1',exp:s.exp,sig:s.sig,hmacSecret:SECRET,now:NOW};
  assert.throws(()=>verifyAssetUrl({...base,id:'img_ffffffffffffffff'}),/ASSET_URL_INVALID/);
  assert.throws(()=>verifyAssetUrl({...base,ws:'ws-2'}),/ASSET_URL_INVALID/);
  assert.throws(()=>verifyAssetUrl({...base,org:'org-2'}),/ASSET_URL_INVALID/);
  assert.throws(()=>verifyAssetUrl({...base,sig:s.sig.slice(0,-1)+(s.sig.endsWith('0')?'1':'0')}),/ASSET_URL_INVALID/);
  assert.throws(()=>verifyAssetUrl({...base,hmacSecret:'different-secret-00000000000000'}),/ASSET_URL_INVALID/);
});
test('rejects expired and over-long-lived urls',()=>{
  const s=sign({ttlMs:60000});
  assert.throws(()=>verifyAssetUrl({id:ID,org:'org-1',ws:'ws-1',exp:s.exp,sig:s.sig,hmacSecret:SECRET,now:NOW+61000}),/ASSET_URL_EXPIRED/);
  const exp=NOW+ASSET_URL_MAX_TTL_MS+1;
  const body=['asset','org-1','ws-1',ID,exp].join('.');
  const forged=createHmac('sha256',SECRET).update(body,'utf8').digest('hex');
  assert.throws(()=>verifyAssetUrl({id:ID,org:'org-1',ws:'ws-1',exp:String(exp),sig:forged,hmacSecret:SECRET,now:NOW}),/ASSET_URL_INVALID/);
});
test('validates inputs and clamps ttl',()=>{
  assert.throws(()=>signAssetUrl({organizationId:'..',workspaceId:'ws-1',assetId:ID,hmacSecret:SECRET,now:NOW}),/ASSET_ORG_INVALID/);
  assert.throws(()=>signAssetUrl({organizationId:'org-1',workspaceId:'ws-1',assetId:'nope',hmacSecret:SECRET,now:NOW}),/ASSET_ID_INVALID/);
  assert.throws(()=>signAssetUrl({organizationId:'org-1',workspaceId:'ws-1',assetId:ID,now:NOW}),/ASSET_SECRET_REQUIRED/);
  assert.throws(()=>verifyAssetUrl({id:ID,org:'org-1',ws:'ws-1',exp:'soon',sig:'0'.repeat(64),hmacSecret:SECRET,now:NOW}),/ASSET_URL_INVALID/);
  assert.throws(()=>verifyAssetUrl({id:ID,org:'org-1',ws:'ws-1',exp:String(NOW+60000),sig:'short',hmacSecret:SECRET,now:NOW}),/ASSET_URL_INVALID/);
  const capped=sign({ttlMs:365*24*60*60*1000});
  assert.ok(Number(capped.exp)-NOW<=ASSET_URL_MAX_TTL_MS);
  const floored=sign({ttlMs:1000});
  assert.equal(Number(floored.exp)-NOW,60000);
});
