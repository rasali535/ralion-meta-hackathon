import test from 'node:test';
import assert from 'node:assert/strict';
import {requestDemoSession,mintDemoWorkspaceId,DEMO_SESSION_ORG,DEMO_SESSION_TTL_MS} from '../lib/demo-session.js';
import {verifyAccessToken} from '../lib/auth.js';
import {createRateLimiter} from '../lib/ratelimit.js';
import {createBudgetLedger} from '../lib/budget.js';

const SECRET='demo-session-test-secret-minimum-32-chars!!';

test('mints isolated demo workspaces with short TTLs',()=>{
  const a=requestDemoSession({clientKey:'judge-a',hmacSecret:SECRET,now:1000,limiter:createRateLimiter({capacity:5,refillIntervalMs:1000})});
  const b=requestDemoSession({clientKey:'judge-b',hmacSecret:SECRET,now:1000,limiter:createRateLimiter({capacity:5,refillIntervalMs:1000})});
  assert.equal(a.organizationId,DEMO_SESSION_ORG);
  assert.match(a.workspaceId,/^demo-[0-9a-f]{12}$/);
  assert.notEqual(a.workspaceId,b.workspaceId);
  assert.equal(a.expiresAt,new Date(1000+DEMO_SESSION_TTL_MS).toISOString());
  assert.equal(DEMO_SESSION_TTL_MS,4*60*60*1000);
});

test('issued tokens verify with the demo tenant',()=>{
  const s=requestDemoSession({clientKey:'judge-a',hmacSecret:SECRET,now:5000,limiter:createRateLimiter({capacity:5,refillIntervalMs:1000})});
  const access=verifyAccessToken(s.token,{hmacSecret:SECRET,now:6000});
  assert.equal(access.organizationId,'demo');
  assert.equal(access.workspaceId,s.workspaceId);
  assert.throws(()=>verifyAccessToken(s.token,{hmacSecret:SECRET,now:6000+DEMO_SESSION_TTL_MS+1}),/AUTH_EXPIRED/);
});

test('rate-limits issuance per client',()=>{
  const limiter=createRateLimiter({capacity:2,refillIntervalMs:60*60*1000});
  requestDemoSession({clientKey:'judge-a',hmacSecret:SECRET,now:1000,limiter});
  requestDemoSession({clientKey:'judge-a',hmacSecret:SECRET,now:1001,limiter});
  assert.throws(()=>requestDemoSession({clientKey:'judge-a',hmacSecret:SECRET,now:1002,limiter}),/RATE_LIMITED/);
  const other=requestDemoSession({clientKey:'judge-b',hmacSecret:SECRET,now:1002,limiter});
  assert.ok(other.token);
});

test('sessions isolate budgets per workspace',()=>{
  const ledger=createBudgetLedger({dailyLimits:{spark:1,wonder:1,image:1,default:1}});
  const a=requestDemoSession({clientKey:'a',hmacSecret:SECRET,now:1000,limiter:createRateLimiter({capacity:5,refillIntervalMs:1000})});
  const b=requestDemoSession({clientKey:'b',hmacSecret:SECRET,now:1000,limiter:createRateLimiter({capacity:5,refillIntervalMs:1000})});
  ledger.recordUsage('demo//'+a.workspaceId,{model:'spark',now:1000});
  assert.throws(()=>ledger.recordUsage('demo//'+a.workspaceId,{model:'spark',now:1000}),/BUDGET_EXCEEDED/);
  assert.ok(ledger.checkBudget('demo//'+b.workspaceId,{model:'spark',now:1000}).allowed);
});

test('requires server secrets and stable ids',()=>{
  assert.throws(()=>requestDemoSession({clientKey:'a',now:1000,limiter:createRateLimiter({capacity:5,refillIntervalMs:1000})}),/AUTH_NOT_CONFIGURED/);
  assert.match(mintDemoWorkspaceId(),/^demo-[0-9a-f]{12}$/);
});
