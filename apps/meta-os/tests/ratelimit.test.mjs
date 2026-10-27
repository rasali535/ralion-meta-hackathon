import test from 'node:test';
import assert from 'node:assert/strict';
import {createRateLimiter} from '../lib/ratelimit.js';

test('allows capacity then blocks with retry-after',()=>{
  let now=1000000;
  const limiter=createRateLimiter({capacity:3,refillIntervalMs:10000,clock:()=>now});
  assert.deepEqual(limiter.check('a'),{allowed:true,retryAfterMs:0,remaining:2});
  assert.deepEqual(limiter.check('a'),{allowed:true,retryAfterMs:0,remaining:1});
  assert.deepEqual(limiter.check('a'),{allowed:true,retryAfterMs:0,remaining:0});
  const blocked=limiter.check('a');
  assert.equal(blocked.allowed,false);
  assert.equal(blocked.remaining,0);
  assert.ok(blocked.retryAfterMs>0&&blocked.retryAfterMs<=10000);
});
test('refills over time and isolates keys',()=>{
  let now=2000000;
  const limiter=createRateLimiter({capacity:2,refillIntervalMs:5000,clock:()=>now});
  assert.equal(limiter.check('a').allowed,true);
  assert.equal(limiter.check('a').allowed,true);
  assert.equal(limiter.check('a').allowed,false);
  assert.equal(limiter.check('b').allowed,true);
  now+=4999;
  assert.equal(limiter.check('a').allowed,false);
  now+=1;
  const refilled=limiter.check('a');
  assert.equal(refilled.allowed,true);
  assert.equal(refilled.remaining,0);
  now+=10000;
  assert.equal(limiter.check('a').remaining,1);
});
test('rejects invalid configuration',()=>{
  assert.throws(()=>createRateLimiter({capacity:0,refillIntervalMs:1000}),/RATE_LIMIT_CONFIG_INVALID/);
  assert.throws(()=>createRateLimiter({capacity:1,refillIntervalMs:0}),/RATE_LIMIT_CONFIG_INVALID/);
  assert.throws(()=>createRateLimiter(),/RATE_LIMIT_CONFIG_INVALID/);
});
test('evicts oldest keys past maxKeys',()=>{
  const limiter=createRateLimiter({capacity:1,refillIntervalMs:60000,maxKeys:2,clock:()=>3000000});
  limiter.check('k1');limiter.check('k2');
  assert.equal(limiter.size(),2);
  limiter.check('k3');
  assert.equal(limiter.size(),2);
  const revived=limiter.check('k1');
  assert.equal(revived.allowed,true);
  assert.equal(revived.remaining,0);
});
test('works with the real clock for a single-shot bucket',()=>{
  const limiter=createRateLimiter({capacity:1,refillIntervalMs:60000});
  assert.equal(limiter.check('solo').allowed,true);
  assert.equal(limiter.check('solo').allowed,false);
});
