/**
 * Minimal in-memory token-bucket rate limiter.
 * Server-only. Per-process memory: correct for one instance, approximate
 * across serverless instances. Inject clock for deterministic tests.
 */
export function createRateLimiter({capacity,refillIntervalMs,maxKeys=10000,clock=()=>Date.now()}={}){
  if(!Number.isInteger(capacity)||capacity<1)throw new Error('RATE_LIMIT_CONFIG_INVALID');
  if(!Number.isInteger(refillIntervalMs)||refillIntervalMs<1)throw new Error('RATE_LIMIT_CONFIG_INVALID');
  const buckets=new Map();
  function take(key,now){
    let b=buckets.get(key);
    if(!b){b={tokens:capacity,updated:now};}
    else if(now>b.updated){
      const refill=Math.floor((now-b.updated)/refillIntervalMs);
      if(refill>0){b.tokens=Math.min(capacity,b.tokens+refill);b.updated+=refill*refillIntervalMs;}
    }
    if(b.tokens<1){
      buckets.delete(key);buckets.set(key,b);
      return {allowed:false,retryAfterMs:Math.max(1,(b.updated+refillIntervalMs)-now),remaining:0};
    }
    b.tokens--;
    buckets.delete(key);buckets.set(key,b);
    if(buckets.size>maxKeys)buckets.delete(buckets.keys().next().value);
    return {allowed:true,retryAfterMs:0,remaining:b.tokens};
  }
  return {check:(key,now=clock())=>take(String(key),now),size:()=>buckets.size};
}
