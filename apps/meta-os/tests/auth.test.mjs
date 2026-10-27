import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {issueDemoToken,verifyAccessToken,tokenFingerprint,DEMO_TOKEN_MAX_TTL_MS,DEMO_TOKEN_DEFAULT_TTL_MS} from '../lib/auth.js';

const SECRET='test-secret-with-32-plus-characters!!';
const NOW=1761600000000;
function opts(over={}){return {hmacSecret:SECRET,now:NOW,...over};}

test('issues and verifies expiring demo tokens',()=>{
  const token=issueDemoToken('cafe-demo',opts({}));
  assert.equal(token.split('.').length,4);
  assert.ok(token.startsWith('v1.cafe-demo.'));
  const access=verifyAccessToken(token,opts({}));
  assert.deepEqual(access,{workspaceId:'cafe-demo',via:'demo'});
});
test('rejects tampered, wrong-secret, and malformed tokens',()=>{
  const token=issueDemoToken('cafe-demo',opts({}));
  const [v,ws,exp,sig]=token.split('.');
  assert.equal(ws,'cafe-demo');
  assert.throws(()=>verifyAccessToken(v+'.evil.'+exp+'.'+sig,opts({})),/AUTH_INVALID/);
  assert.throws(()=>verifyAccessToken(token.slice(0,-1)+(sig.endsWith('0')?'1':'0'),opts({})),/AUTH_INVALID/);
  assert.throws(()=>verifyAccessToken(token,opts({hmacSecret:'different-secret-00000000000000'})),/AUTH_INVALID/);
  for(const bad of ['v1.cafe-demo','v2.cafe-demo.'+exp+'.'+sig,'v1.bad!ws.'+exp+'.'+sig,'v1.cafe-demo.notanumber.'+sig,'v1.cafe-demo.'+exp+'.short','',null,undefined,123,'x'.repeat(501)])assert.throws(()=>verifyAccessToken(bad,opts({})),/AUTH_INVALID/,String(bad).slice(0,40));
});
test('rejects expired and over-long-lived tokens',()=>{
  const short=issueDemoToken('cafe-demo',opts({ttlMs:60000}));
  assert.throws(()=>verifyAccessToken(short,opts({now:NOW+60001})),/AUTH_EXPIRED/);
  const exp=NOW+DEMO_TOKEN_MAX_TTL_MS+1;
  const body='v1.cafe-demo.'+exp;
  const forged=body+'.'+createHmac('sha256',SECRET).update(body,'utf8').digest('hex');
  assert.throws(()=>verifyAccessToken(forged,opts({})),/AUTH_INVALID/);
});
test('accepts the static integration token and fails closed otherwise',()=>{
  const access=verifyAccessToken('static-int-1',opts({staticToken:'static-int-1'}));
  assert.deepEqual(access,{workspaceId:'integration',via:'static'});
  assert.throws(()=>verifyAccessToken('static-int-2',opts({staticToken:'static-int-1'})),/AUTH_INVALID/);
  assert.throws(()=>verifyAccessToken('static-int-1',{now:NOW}),/AUTH_NOT_CONFIGURED/);
  assert.throws(()=>verifyAccessToken('anything',{now:NOW}),/AUTH_NOT_CONFIGURED/);
});
test('validates issuance inputs and clamps TTL',()=>{
  assert.throws(()=>issueDemoToken('bad ws!',opts({})),/DEMO_WORKSPACE_INVALID/);
  assert.throws(()=>issueDemoToken('',opts({})),/DEMO_WORKSPACE_INVALID/);
  assert.throws(()=>issueDemoToken('ok',{now:NOW}),/AUTH_NOT_CONFIGURED/);
  const capped=issueDemoToken('cafe-demo',opts({ttlMs:365*24*60*60*1000}));
  const exp=Number(capped.split('.')[2]);
  assert.ok(exp-NOW<=DEMO_TOKEN_MAX_TTL_MS);
  const floored=issueDemoToken('cafe-demo',opts({ttlMs:1000}));
  assert.equal(Number(floored.split('.')[2])-NOW,60000);
  const def=issueDemoToken('cafe-demo',opts({}));
  assert.equal(Number(def.split('.')[2])-NOW,DEMO_TOKEN_DEFAULT_TTL_MS);
});
test('fingerprints are stable, short, and non-reversing',()=>{
  const token=issueDemoToken('cafe-demo',opts({}));
  const fp=tokenFingerprint(token);
  assert.equal(fp,tokenFingerprint(token));
  assert.match(fp,/^fp_[0-9a-f]{16}$/);
  assert.ok(!fp.includes('cafe-demo'));
  assert.notEqual(fp,tokenFingerprint(token+'x'));
});
