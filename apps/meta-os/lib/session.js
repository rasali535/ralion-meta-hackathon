/**
 * Consolidated Demo Session Management for Ralion Meta OS.
 *
 * Implements short-lived, tenant-scoped demo sessions with:
 * - Server-side issued v2 HMAC demo tokens
 * - Abuse controls: IP-keyed rate limits (5 per hour per client)
 * - Pinned tenant isolation: strictly bound to 'demo' (rejects arbitrary org impersonation)
 * - Random isolated workspace minting (`demo-<hex>`) or sanitized custom names
 * - Secure, HttpOnly, SameSite=Lax cookie serialization (`ralion_demo_session`)
 * - Backward compatibility with `x-meta-demo-access` headers
 * - Session revocation registry (best-effort single-container) + 4-hour hard TTL expiration
 *
 * Server-only: never import into client components.
 */
import {randomBytes,createHash} from 'node:crypto';
import {issueDemoToken,verifyAccessToken,tokenFingerprint,tenantContext} from './auth.js';
import {createRateLimiter} from './ratelimit.js';

export const DEMO_SESSION_COOKIE='ralion_demo_session';
export const DEMO_SESSION_ORG='demo';
export const DEMO_ORG_ID=DEMO_SESSION_ORG; // alias for backwards compatibility
export const DEMO_SESSION_TTL_MS=4*60*60*1000; // 4 hours
export const DEFAULT_SESSION_TTL_MS=DEMO_SESSION_TTL_MS;
export const MAX_SESSION_TTL_MS=4*60*60*1000;
export const DEMO_SESSION_ISSUE_LIMIT=5;
export const DEMO_SESSION_ISSUE_WINDOW_MS=60*60*1000;

export const demoSessionLimiter=createRateLimiter({
  capacity:DEMO_SESSION_ISSUE_LIMIT,
  refillIntervalMs:DEMO_SESSION_ISSUE_WINDOW_MS/DEMO_SESSION_ISSUE_LIMIT
});

const WS_SANITIZE_RE=/[^a-z0-9_-]/gi;

// In-memory revocation set preserved across hot-module-reloads in Node.js
const revokedSessions=globalThis.__ralionRevokedSessions||(globalThis.__ralionRevokedSessions=new Set());

export function getFallbackDemoSecret(){
  if(!globalThis.__ralionDemoSecret){
    globalThis.__ralionDemoSecret='ralion_demo_secret_'+createHash('sha256').update(String(process.pid)+':'+String(Date.now())).digest('hex');
  }
  return globalThis.__ralionDemoSecret;
}

export function mintDemoWorkspaceId(random=randomBytes){
  return 'demo-'+random(6).toString('hex');
}

export function sanitizeWorkspaceName(raw,random=randomBytes){
  let s=String(raw||'').trim().toLowerCase().replace(WS_SANITIZE_RE,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  if(!s||s==='workspace'||s==='demo'){
    return 'ws_'+mintDemoWorkspaceId(random);
  }
  if(s.startsWith('ws-')){
    s='ws_'+s.slice(3);
  }else if(!s.startsWith('ws_')){
    s='ws_'+s;
  }
  return s.slice(0,48);
}

export function revokeSession(token){
  if(!token)return;
  const fp=tokenFingerprint(token);
  revokedSessions.add(fp);
}

export function isSessionRevoked(token){
  if(!token)return false;
  const fp=tokenFingerprint(token);
  return revokedSessions.has(fp);
}

export function clearRevocationList(){
  revokedSessions.clear();
}

/**
 * Mint demo session adhering to Muse contract with abuse rate limiting.
 */
export function requestDemoSession({clientKey,hmacSecret,now=Date.now(),limiter=demoSessionLimiter,issue=issueDemoToken,random=randomBytes}={}){
  const key=String(clientKey||'direct').slice(0,120)||'direct';
  if(!hmacSecret)throw new Error('AUTH_NOT_CONFIGURED');
  const check=limiter.check(key,Number(now));
  if(!check.allowed){
    const e=new Error('DEMO_SESSION_RATE_LIMITED');
    e.retryAfterMs=check.retryAfterMs;
    throw e;
  }
  const workspaceId=mintDemoWorkspaceId(random);
  const token=issue(workspaceId,{organizationId:DEMO_SESSION_ORG,hmacSecret,ttlMs:DEMO_SESSION_TTL_MS,now:Number(now)});
  return {token,organizationId:DEMO_SESSION_ORG,workspaceId,expiresAt:new Date(Number(now)+DEMO_SESSION_TTL_MS).toISOString()};
}

/**
 * Creates a demo session supporting custom workspace naming and cookie options.
 */
export function createDemoSession({workspaceName,ttlMs=DEFAULT_SESSION_TTL_MS,env=process.env,now=Date.now(),clientKey,limiter=demoSessionLimiter,random=randomBytes}={}){
  if(clientKey){
    const check=limiter.check(String(clientKey).slice(0,120),Number(now));
    if(!check.allowed){
      const e=new Error('DEMO_SESSION_RATE_LIMITED');
      e.retryAfterMs=check.retryAfterMs;
      throw e;
    }
  }
  const secret=env.META_DEMO_TOKEN_SECRET||getFallbackDemoSecret();
  const workspaceId=workspaceName?sanitizeWorkspaceName(workspaceName,random):mintDemoWorkspaceId(random);
  const clampedTtl=Math.max(60*1000,Math.min(MAX_SESSION_TTL_MS,Number(ttlMs)||DEFAULT_SESSION_TTL_MS));
  const token=issueDemoToken(workspaceId,{
    organizationId:DEMO_SESSION_ORG,
    hmacSecret:secret,
    ttlMs:clampedTtl,
    now:Number(now)
  });
  const expMs=Number(now)+clampedTtl;
  return {
    token,
    organizationId:DEMO_SESSION_ORG,
    workspaceId,
    expiresAt:new Date(expMs).toISOString(),
    ttlMs:clampedTtl,
    fingerprint:tokenFingerprint(token)
  };
}

export function extractTokenFromRequest(req){
  if(!req)return null;
  // 1. Next.js Request cookies (if req.cookies.get exists)
  if(req.cookies&&typeof req.cookies.get==='function'){
    const c=req.cookies.get(DEMO_SESSION_COOKIE);
    if(c&&c.value)return c.value.trim();
  }
  // 2. Parse standard Cookie header
  const rawCookie=req.headers?.get?req.headers.get('cookie'):(typeof req.headers==='string'?req.headers:null);
  if(rawCookie){
    const match=rawCookie.match(/(?:^|;\s*)ralion_demo_session=([^;]+)/);
    if(match&&match[1])return decodeURIComponent(match[1].trim());
  }
  // 3. Fallback header for CLI / testing backwards compatibility
  const header=req.headers?.get?req.headers.get('x-meta-demo-access'):null;
  if(header)return header.trim();
  return null;
}

export function resolveRequestAuth(req,{env=process.env,now=Date.now()}={}){
  const token=extractTokenFromRequest(req);
  if(!token){
    const err=new Error('AUTH_REQUIRED: Demo session or token required');
    err.httpStatus=401;
    err.code='AUTH_REQUIRED';
    throw err;
  }
  if(isSessionRevoked(token)){
    const err=new Error('AUTH_REVOKED: Demo session has been revoked');
    err.httpStatus=401;
    err.code='AUTH_REVOKED';
    throw err;
  }
  const secret=env.META_DEMO_TOKEN_SECRET||getFallbackDemoSecret();
  let access;
  try{
    access=verifyAccessToken(token,{
      staticToken:env.META_REASONING_ACCESS_TOKEN,
      hmacSecret:secret,
      now
    });
  }catch(e){
    const isExpired=e&&e.message==='AUTH_EXPIRED';
    const err=new Error(isExpired?'AUTH_EXPIRED: Demo session has expired':'AUTH_INVALID: Invalid demo session');
    err.httpStatus=401;
    err.code=e&&e.message?e.message:'AUTH_INVALID';
    throw err;
  }
  const tenant=tenantContext(access);
  return {
    organizationId:tenant.organizationId,
    workspaceId:tenant.workspaceId,
    via:access.via,
    fingerprint:tokenFingerprint(token),
    token
  };
}

export function createSessionCookieString(token,{maxAgeSec=Math.floor(DEFAULT_SESSION_TTL_MS/1000),secure=false}={}){
  const parts=[
    `${DEMO_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ];
  if(secure)parts.push('Secure');
  return parts.join('; ');
}

export function createRevokeCookieString({secure=false}={}){
  const parts=[
    `${DEMO_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];
  if(secure)parts.push('Secure');
  return parts.join('; ');
}
