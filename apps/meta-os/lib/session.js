/**
 * Server-side Demo Session Management for Ralion Meta OS.
 *
 * Implements short-lived, tenant-scoped demo sessions using Secure,
 * HttpOnly, SameSite=Lax cookies. Prevents arbitrary organization
 * impersonation by pinning organizationId to 'org_demo'.
 * Provides session issuance, request authentication, workspace sanitization,
 * and server-side in-memory revocation.
 *
 * Server-only: never import into client components.
 */
import {randomBytes,createHash} from 'node:crypto';
import {issueDemoToken,verifyAccessToken,tokenFingerprint,tenantContext} from './auth.js';

export const DEMO_SESSION_COOKIE='ralion_demo_session';
export const DEMO_ORG_ID='org_demo';
export const DEFAULT_SESSION_TTL_MS=2*60*60*1000; // 2 hours
export const MAX_SESSION_TTL_MS=4*60*60*1000;     // 4 hours

const WS_SANITIZE_RE=/[^a-z0-9_-]/gi;

// In-memory revocation set preserved across hot-module-reloads in Node.js
const revokedSessions=globalThis.__ralionRevokedSessions||(globalThis.__ralionRevokedSessions=new Set());

export function getFallbackDemoSecret(){
  if(!globalThis.__ralionDemoSecret){
    globalThis.__ralionDemoSecret='ralion_demo_secret_'+createHash('sha256').update(String(process.pid)+':'+String(Date.now())).digest('hex');
  }
  return globalThis.__ralionDemoSecret;
}

export function sanitizeWorkspaceName(raw){
  let s=String(raw||'').trim().toLowerCase().replace(WS_SANITIZE_RE,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  if(!s||s==='workspace'||s==='demo'){
    s='demo-'+randomBytes(3).toString('hex');
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

export function createDemoSession({workspaceName,ttlMs=DEFAULT_SESSION_TTL_MS,env=process.env,now=Date.now()}={}){
  const secret=env.META_DEMO_TOKEN_SECRET||getFallbackDemoSecret();
  const workspaceId=sanitizeWorkspaceName(workspaceName);
  const clampedTtl=Math.max(60*1000,Math.min(MAX_SESSION_TTL_MS,Number(ttlMs)||DEFAULT_SESSION_TTL_MS));
  const token=issueDemoToken(workspaceId,{
    organizationId:DEMO_ORG_ID,
    hmacSecret:secret,
    ttlMs:clampedTtl,
    now
  });
  const expMs=now+clampedTtl;
  return {
    token,
    organizationId:DEMO_ORG_ID,
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
