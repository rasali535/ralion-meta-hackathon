import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {issueDemoToken,verifyAccessToken,tokenFingerprint,tenantContext,DEMO_TOKEN_MAX_TTL_MS,DEMO_TOKEN_DEFAULT_TTL_MS} from '../lib/auth.js';

const SECRET='test-secret-with-32-plus-characters!!';
const NOW=1761600000000;
function opts(over={}){return {hmacSecret:SECRET,now:NOW,...over};}

test('issues and verifies tenant-scoped v2 demo tokens',()=>{
  const token=issueDemoToken('cafe-demo',{...opts({}),organizationId:'acme'});
  assert.equal(token.split('.').length,5);
  assert.ok(token.startsWith('v2.acme.cafe-demo.'));
  const access=verifyAccessToken(token,opts({}));
  assert.deepEqual(access,{organizationId:'acme',workspaceId:'cafe-demo',via:'demo'});
});
test('rejects tampered, wrong-secret, malformed, and legacy v1 tokens',()=>{
  const token=issueDemoToken('cafe-demo',{...opts({}),organizationId:'acme'});
  const [v,org,ws,exp,sig]=token.split('.');
  assert.equal(v,'v2');
  assert.throws(()=>verifyAccessToken([v,'evil',ws,exp,sig].join('.'),opts({})),/AUTH_INVALID/);
  assert.throws(()=>verifyAccessToken([v,org,'evil',exp,sig].join('.'),opts({})),/AUTH_INVALID/);
  assert.throws(()=>verifyAccessToken(token.slice(0,-1)+(sig.endsWith('0')?'1':'0'),opts({})),/AUTH_INVALID/);
  assert.throws(()=>verifyAccessToken(token,opts({hmacSecret:'different-secret-00000000000000'})),/AUTH_INVALID/);
  const legacy='v1.cafe-demo.'+exp+'.'+'0'.repeat(64);
  for(const bad of [legacy,'v2.acme.cafe-demo','v1.acme.cafe-demo.'+exp+'.'+sig,'v2.bad!org.cafe-demo.'+exp+'.'+sig,'v2.acme.bad!ws.'+exp+'.'+sig,'v2.acme.cafe-demo.notanumber.'+sig,'v2.acme.cafe-demo.'+exp+'.short','',null,undefined,123,'x'.repeat(501)])assert.throws(()=>verifyAccessToken(bad,opts({})),/AUTH_INVALID/,String(bad).slice(0,40));
});
test('rejects expired and over-long-lived tokens',()=>{
  const short=issueDemoToken('cafe-demo',{...opts({}),organizationId:'acme',ttlMs:60000});
  assert.throws(()=>verifyAccessToken(short,opts({now:NOW+60001})),/AUTH_EXPIRED/);
  const exp=NOW+DEMO_TOKEN_MAX_TTL_MS+1;
  const body='v2.acme.cafe-demo.'+exp;
  const forged=body+'.'+createHmac('sha256',SECRET).update(body,'utf8').digest('hex');
  assert.throws(()=>verifyAccessToken(forged,opts({})),/AUTH_INVALID/);
});
test('accepts the static integration token and fails closed otherwise',()=>{
  const access=verifyAccessToken('static-int-1',opts({staticToken:'static-int-1'}));
  assert.deepEqual(access,{organizationId:'integration',workspaceId:'integration',via:'static'});
  assert.throws(()=>verifyAccessToken('static-int-2',opts({staticToken:'static-int-1'})),/AUTH_INVALID/);
  assert.throws(()=>verifyAccessToken('static-int-1',{now:NOW}),/AUTH_NOT_CONFIGURED/);
  assert.throws(()=>verifyAccessToken('anything',{now:NOW}),/AUTH_NOT_CONFIGURED/);
});
test('validates issuance inputs and clamps TTL',()=>{
  assert.throws(()=>issueDemoToken('cafe-demo',opts({})),/DEMO_ORG_INVALID/);
  assert.throws(()=>issueDemoToken('cafe-demo',{...opts({}),organizationId:'bad org!'}),/DEMO_ORG_INVALID/);
  assert.throws(()=>issueDemoToken('bad ws!',{...opts({}),organizationId:'acme'}),/DEMO_WORKSPACE_INVALID/);
  assert.throws(()=>issueDemoToken('ok',{organizationId:'acme',now:NOW}),/AUTH_NOT_CONFIGURED/);
  const capped=issueDemoToken('cafe-demo',{...opts({}),organizationId:'acme',ttlMs:365*24*60*60*1000});
  const exp=Number(capped.split('.')[3]);
  assert.ok(exp-NOW<=DEMO_TOKEN_MAX_TTL_MS);
  const floored=issueDemoToken('cafe-demo',{...opts({}),organizationId:'acme',ttlMs:1000});
  assert.equal(Number(floored.split('.')[3])-NOW,60000);
  const def=issueDemoToken('cafe-demo',{...opts({}),organizationId:'acme'});
  assert.equal(Number(def.split('.')[3])-NOW,DEMO_TOKEN_DEFAULT_TTL_MS);
});
test('fingerprints are stable, short, and non-reversing',()=>{
  const token=issueDemoToken('cafe-demo',{...opts({}),organizationId:'acme'});
  const fp=tokenFingerprint(token);
  assert.equal(fp,tokenFingerprint(token));
  assert.match(fp,/^fp_[0-9a-f]{16}$/);
  assert.ok(!fp.includes('cafe-demo'));
  assert.notEqual(fp,tokenFingerprint(token+'x'));
});
test('tenantContext requires explicit organization and workspace',()=>{
  assert.deepEqual(tenantContext({organizationId:'acme',workspaceId:'ws-1',via:'demo'}),{organizationId:'acme',workspaceId:'ws-1'});
  assert.deepEqual(tenantContext({organizationId:'  acme ',workspaceId:'ws-1'}),{organizationId:'acme',workspaceId:'ws-1'});
  for(const bad of [null,undefined,{},{organizationId:'acme'},{workspaceId:'ws-1'},{organizationId:'',workspaceId:'ws-1'},{organizationId:'acme',workspaceId:''}])assert.throws(()=>tenantContext(bad),/AUTH_TENANT_REQUIRED/);
});
