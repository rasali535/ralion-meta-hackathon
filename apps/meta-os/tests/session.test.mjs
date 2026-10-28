import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDemoSession,
  sanitizeWorkspaceName,
  extractTokenFromRequest,
  resolveRequestAuth,
  revokeSession,
  isSessionRevoked,
  clearRevocationList,
  createSessionCookieString,
  createRevokeCookieString,
  DEMO_SESSION_COOKIE,
  DEMO_ORG_ID,
  DEFAULT_SESSION_TTL_MS
} from '../lib/session.js';
import {verifyAccessToken} from '../lib/auth.js';

const SECRET='test-secret-with-32-plus-characters!!';
const NOW=1761600000000;

function env(over={}){
  return {META_DEMO_TOKEN_SECRET:SECRET,...over};
}

test('creates a valid tenant-scoped demo session pinned to org_demo',()=>{
  clearRevocationList();
  const session=createDemoSession({workspaceName:'my store',env:env(),now:NOW});
  assert.equal(session.organizationId,DEMO_ORG_ID);
  assert.ok(session.workspaceId.startsWith('ws_'));
  assert.equal(session.ttlMs,DEFAULT_SESSION_TTL_MS);
  assert.equal(new Date(session.expiresAt).getTime(),NOW+DEFAULT_SESSION_TTL_MS);

  // Validate that issued token verifies with auth module
  const access=verifyAccessToken(session.token,{hmacSecret:SECRET,now:NOW});
  assert.equal(access.organizationId,DEMO_ORG_ID);
  assert.equal(access.workspaceId,session.workspaceId);
  assert.equal(access.via,'demo');
});

test('sanitizes arbitrary workspace inputs and prevents path / symbol injection',()=>{
  assert.equal(sanitizeWorkspaceName('  Coffee & Tea Store!  '),'ws_coffee-tea-store');
  assert.equal(sanitizeWorkspaceName('ws_already_prefixed'),'ws_already_prefixed');
  assert.equal(sanitizeWorkspaceName('../../escape/attempt'),'ws_escape-attempt');
  assert.ok(sanitizeWorkspaceName('').startsWith('ws_demo-'));
  assert.ok(sanitizeWorkspaceName('   ').startsWith('ws_demo-'));
  // Clamps length
  const huge='a'.repeat(100);
  assert.ok(sanitizeWorkspaceName(huge).length<=48);
});

test('prevents arbitrary organization impersonation',()=>{
  // createDemoSession does not accept organizationId from caller; always binds org_demo
  const session=createDemoSession({organizationId:'org_production',workspaceName:'target',env:env(),now:NOW});
  assert.equal(session.organizationId,DEMO_ORG_ID);
  assert.notEqual(session.organizationId,'org_production');
});

test('extracts token from Next.js cookies, raw cookie header, and fallback header',()=>{
  const fakeToken='v2.org_demo.ws_test.1761600000000.sig';

  // 1. Next.js Request cookies object
  const nextReq={cookies:new Map([[DEMO_SESSION_COOKIE,{value:fakeToken}]])};
  assert.equal(extractTokenFromRequest(nextReq),fakeToken);

  // 2. Standard Cookie header
  const headerReq={headers:new Headers({cookie:`foo=bar; ${DEMO_SESSION_COOKIE}=${fakeToken}; other=1`})};
  assert.equal(extractTokenFromRequest(headerReq),fakeToken);

  // 3. Fallback header for CLI / test backwards compatibility
  const fallbackReq={headers:new Headers({'x-meta-demo-access':fakeToken})};
  assert.equal(extractTokenFromRequest(fallbackReq),fakeToken);

  // 4. Missing credentials
  assert.equal(extractTokenFromRequest({headers:new Headers()}),null);
  assert.equal(extractTokenFromRequest(null),null);
});

test('resolveRequestAuth verifies active session and rejects expired or missing sessions',()=>{
  clearRevocationList();
  const session=createDemoSession({workspaceName:'ws-alpha',env:env(),now:NOW});
  const req={headers:new Headers({cookie:`${DEMO_SESSION_COOKIE}=${session.token}`})};

  // Valid session
  const auth=resolveRequestAuth(req,{env:env(),now:NOW});
  assert.equal(auth.organizationId,DEMO_ORG_ID);
  assert.equal(auth.workspaceId,'ws_alpha');
  assert.equal(auth.via,'demo');
  assert.match(auth.fingerprint,/^fp_[0-9a-f]{16}$/);

  // Missing session
  assert.throws(
    ()=>resolveRequestAuth({headers:new Headers()},{env:env(),now:NOW}),
    /AUTH_REQUIRED/
  );

  // Expired session
  assert.throws(
    ()=>resolveRequestAuth(req,{env:env(),now:NOW+DEFAULT_SESSION_TTL_MS+1}),
    /AUTH_EXPIRED/
  );
});

test('supports server-side session revocation before TTL expiry',()=>{
  clearRevocationList();
  const session=createDemoSession({workspaceName:'revoke-test',env:env(),now:NOW});
  const req={headers:new Headers({cookie:`${DEMO_SESSION_COOKIE}=${session.token}`})};

  // Initially valid
  assert.equal(isSessionRevoked(session.token),false);
  const initial=resolveRequestAuth(req,{env:env(),now:NOW});
  assert.equal(initial.workspaceId,'ws_revoke-test');

  // Revoke session
  revokeSession(session.token);
  assert.equal(isSessionRevoked(session.token),true);

  // Subsequent auth attempts fail with AUTH_REVOKED
  assert.throws(
    ()=>resolveRequestAuth(req,{env:env(),now:NOW}),
    /AUTH_REVOKED/
  );
});

test('generates compliant Set-Cookie headers for issuance and revocation',()=>{
  const token='test-token-value';

  // Issue cookie (dev mode)
  const devCookie=createSessionCookieString(token,{maxAgeSec:7200,secure:false});
  assert.ok(devCookie.includes(`${DEMO_SESSION_COOKIE}=${token}`));
  assert.ok(devCookie.includes('Path=/'));
  assert.ok(devCookie.includes('HttpOnly'));
  assert.ok(devCookie.includes('SameSite=Lax'));
  assert.ok(devCookie.includes('Max-Age=7200'));
  assert.ok(!devCookie.includes('Secure'));

  // Issue cookie (production mode)
  const prodCookie=createSessionCookieString(token,{maxAgeSec:7200,secure:true});
  assert.ok(prodCookie.includes('Secure'));

  // Revoke cookie (clears immediately)
  const revokeCookie=createRevokeCookieString({secure:true});
  assert.ok(revokeCookie.includes(`${DEMO_SESSION_COOKIE}=;`));
  assert.ok(revokeCookie.includes('Max-Age=0'));
  assert.ok(revokeCookie.includes('Expires=Thu, 01 Jan 1970 00:00:00 GMT'));
  assert.ok(revokeCookie.includes('Secure'));
});

test('enforces strict tenant isolation across different sessions',()=>{
  clearRevocationList();
  const s1=createDemoSession({workspaceName:'retail-store-1',env:env(),now:NOW});
  const s2=createDemoSession({workspaceName:'retail-store-2',env:env(),now:NOW});

  const a1=resolveRequestAuth({headers:new Headers({cookie:`${DEMO_SESSION_COOKIE}=${s1.token}`})},{env:env(),now:NOW});
  const a2=resolveRequestAuth({headers:new Headers({cookie:`${DEMO_SESSION_COOKIE}=${s2.token}`})},{env:env(),now:NOW});

  assert.equal(a1.workspaceId,'ws_retail-store-1');
  assert.equal(a2.workspaceId,'ws_retail-store-2');
  assert.notEqual(a1.workspaceId,a2.workspaceId);
  assert.notEqual(a1.fingerprint,a2.fingerprint);
});
